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

st.set_page_config(page_title="Assignments", page_icon="📋", layout="wide")

if "token" not in st.session_state:
    st.switch_page("streamlit_app.py")

selected_course = st.session_state.get("selected_course")

if not selected_course:
    st.warning("No course selected. Go to Courses page first.")
    if st.button("Back to Courses"):
        st.switch_page("pages/1_Courses.py")
    st.stop()

st.title(f"📋 Assignments - {selected_course['code']} - {selected_course['name']}")

col1, col2 = st.columns([3, 1])
with col1:
    st.subheader("Assignments")
with col2:
    if st.button("➕ Create Assignment"):
        st.session_state.show_create = True

if st.session_state.get("show_create"):
    with st.form("create_assignment"):
        title = st.text_input("Assignment Title*", placeholder="e.g., Essay on Cognitive Development")
        description = st.text_area("Description", placeholder="Assignment instructions...")
        max_score = st.number_input("Max Score", min_value=1, value=100)
        due_date = st.date_input("Due Date (optional)")
        submitted = st.form_submit_button("Create")
        if submitted and title:
            result = api_request("POST", "/assignments", json={
                "title": title,
                "description": description,
                "max_score": max_score,
                "due_date": due_date.isoformat() if due_date else None,
                "course_id": selected_course["id"],
            })
            if result:
                st.success("Assignment created!")
                st.session_state.show_create = False
                st.rerun()

assignments = api_request("GET", f"/assignments?course_id={selected_course['id']}")

if assignments:
    for a in assignments:
        with st.expander(f"{a['title']} (Max: {a['max_score']})"):
            st.write(f"**Description:** {a.get('description', 'N/A')}")
            if a.get('due_date'):
                st.write(f"**Due:** {a['due_date'][:10]}")
            
            cols = st.columns(4)
            with cols[0]:
                if st.button("📝 Rubric", key=f"rubric_{a['id']}"):
                    st.session_state.selected_assignment = a
                    st.switch_page("pages/3_RubricBuilder.py")
            with cols[1]:
                if st.button("📤 Upload", key=f"upload_{a['id']}"):
                    st.session_state.selected_assignment = a
                    st.switch_page("pages/4_UploadGrade.py")
            with cols[2]:
                if st.button("📊 Results", key=f"results_{a['id']}"):
                    st.session_state.selected_assignment = a
                    st.switch_page("pages/5_Results.py")
            with cols[3]:
                if st.button("🗑️ Delete", key=f"del_a_{a['id']}", type="secondary"):
                    if api_request("DELETE", f"/assignments/{a['id']}"):
                        st.success("Deleted!")
                        st.rerun()
else:
    st.info("No assignments yet. Create one above!")