import streamlit as st
import requests
import os
from dotenv import load_dotenv

load_dotenv()
API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")

def api_request(method, endpoint, **kwargs):
    url = f"{API_BASE}{endpoint}"
    headers = kwargs.pop("headers", {})
    if "token" in st.session_state:
        headers["Authorization"] = f"Bearer {st.session_state.token}"
    try:
        resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        st.error(f"API Error: {e}")
        return None

st.set_page_config(page_title="Courses", page_icon="📚", layout="wide")

if "token" not in st.session_state:
    st.switch_page("streamlit_app.py")

st.title("📚 Courses")

tab1, tab2 = st.tabs(["My Courses", "Create Course"])

with tab1:
    st.subheader("Your Courses")
    courses = api_request("GET", "/courses")
    if courses:
        for course in courses:
            with st.expander(f"{course['code']} - {course['name']}"):
                st.write(f"**Description:** {course.get('description', 'N/A')}")
                st.write(f"**Created:** {course['created_at']}")
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("View Assignments", key=f"view_{course['id']}"):
                        st.session_state.selected_course = course
                        st.switch_page("pages/2_Assignments.py")
                with col2:
                    if st.button("Delete", key=f"del_{course['id']}", type="secondary"):
                        if api_request("DELETE", f"/courses/{course['id']}"):
                            st.success("Deleted!")
                            st.rerun()

with tab2:
    st.subheader("Create New Course")
    with st.form("create_course"):
        name = st.text_input("Course Name*", placeholder="e.g., Introduction to Psychology")
        code = st.text_input("Course Code*", placeholder="e.g., PSY101")
        description = st.text_area("Description", placeholder="Course description...")
        submitted = st.form_submit_button("Create Course")
        
        if submitted and name and code:
            result = api_request("POST", "/courses", json={"name": name, "code": code, "description": description})
            if result:
                st.success(f"Created course: {result['name']}")
                st.rerun()