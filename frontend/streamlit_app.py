import streamlit as st
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")

st.set_page_config(
    page_title="TA Grader",
    page_icon="📝",
    layout="wide",
    initial_sidebar_state="expanded",
)

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

def login_page():
    st.title("📝 TA Grader")
    st.subheader("Sign in to continue")
    
    with st.form("login"):
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Sign In")
        
        if submitted:
            st.info("Using Clerk/Supabase Auth - implement OAuth flow here")
            st.session_state.token = "dev-token"
            st.session_state.user = {"email": email, "role": "ta"}
            st.rerun()

def sidebar():
    with st.sidebar:
        st.title("📝 TA Grader")
        if "user" in st.session_state:
            st.write(f"Logged in as: {st.session_state.user['email']}")
            st.write(f"Role: {st.session_state.user['role']}")
        st.divider()
        
        pages = {
            "Courses": "1_Courses",
            "Assignments": "2_Assignments",
            "Rubric Builder": "3_RubricBuilder",
            "Upload & Grade": "4_UploadGrade",
            "Results": "5_Results",
        }
        
        for label, page in pages.items():
            if st.button(label, use_container_width=True):
                st.switch_page(f"pages/{page}.py")
        
        st.divider()
        if st.button("Logout", use_container_width=True):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

def main():
    if "token" not in st.session_state:
        login_page()
        return
    
    sidebar()
    
    st.title("Dashboard")
    st.write("Welcome to TA Grader! Use the sidebar to navigate.")

if __name__ == "__main__":
    main()