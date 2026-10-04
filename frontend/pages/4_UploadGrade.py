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
        resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        st.error(f"API Error: {e}")
        return None

st.set_page_config(page_title="Upload & Grade", page_icon="📤", layout="wide")

if "token" not in st.session_state:
    st.switch_page("streamlit_app.py")

assignment = st.session_state.get("selected_assignment")

if not assignment:
    st.warning("No assignment selected.")
    if st.button("Back to Assignments"):
        st.switch_page("pages/2_Assignments.py")
    st.stop()

rubric = api_request("GET", f"/rubrics/assignment/{assignment['id']}")

st.title(f"📤 Upload & Grade - {assignment['title']}")

if not rubric:
    st.warning("No rubric found for this assignment. Create one first.")
    if st.button("Go to Rubric Builder"):
        st.switch_page("pages/3_RubricBuilder.py")
    st.stop()

tab1, tab2 = st.tabs(["Upload Submissions", "Grade Submissions"])

with tab1:
    st.subheader("Upload Student Work")
    
    with st.form("upload_form", clear_on_submit=True):
        col1, col2 = st.columns(2)
        with col1:
            student_name = st.text_input("Student Name*")
            student_id = st.text_input("Student ID (optional)")
        with col2:
            uploaded_file = st.file_uploader("Upload PDF/Image*", type=["pdf", "png", "jpg", "jpeg", "tiff", "tif"])
        
        submitted = st.form_submit_button("Upload & Extract Text", type="primary")
        
        if submitted and student_name and uploaded_file:
            with st.spinner("Uploading and extracting text..."):
                files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                data = {
                    "assignment_id": assignment["id"],
                    "student_name": student_name,
                    "student_id": student_id or "",
                }
                result = api_request("POST", "/submissions/upload", data=data, files=files)
                if result:
                    st.success(f"Uploaded! Submission ID: {result['id']}")
                    st.info("Text extraction happens in background. Refresh to see extracted text.")

    st.divider()
    st.subheader("Recent Submissions")
    submissions = api_request("GET", f"/submissions?assignment_id={assignment['id']}")
    
    if submissions:
        for sub in submissions[:10]:
            with st.expander(f"{sub['student_name']} ({sub['student_id'] or 'N/A'}) - {sub['status']}"):
                st.write(f"**File:** {sub['original_filename']}")
                st.write(f"**Status:** {sub['status']}")
                if sub.get("extracted_text"):
                    st.text_area("Extracted Text", sub["extracted_text"][:500] + "...", height=100, disabled=True)
                else:
                    st.caption("Text not yet extracted")

with tab2:
    st.subheader("Grade Submissions")
    
    ungraded = [s for s in (submissions or []) if s["status"] in ["uploaded", "processing"]]
    
    if not ungraded:
        st.info("No ungraded submissions")
    else:
        for sub in ungraded:
            with st.container(border=True):
                col1, col2, col3 = st.columns([3, 1, 1])
                with col1:
                    st.write(f"**{sub['student_name']}** ({sub['student_id'] or 'N/A'})")
                    st.caption(f"File: {sub['original_filename']}")
                with col2:
                    st.write(f"Status: `{sub['status']}`")
                with col3:
                    if st.button("Grade with AI", key=f"grade_{sub['id']}", type="primary"):
                        with st.spinner("Grading with AI..."):
                            result = api_request("POST", "/grading/grade", json={
                                "submission_id": sub["id"],
                                "rubric_id": rubric["id"],
                            })
                            if result:
                                st.success("Graded!")
                                st.rerun()
                
                if sub.get("extracted_text"):
                    with st.expander("View Extracted Text"):
                        st.text_area("", sub["extracted_text"], height=200, disabled=True, key=f"text_{sub['id']}")