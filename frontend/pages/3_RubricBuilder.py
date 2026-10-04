import streamlit as st
import requests
import json
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

st.set_page_config(page_title="Rubric Builder", page_icon="📝", layout="wide")

if "token" not in st.session_state:
    st.switch_page("streamlit_app.py")

assignment = st.session_state.get("selected_assignment")

if not assignment:
    st.warning("No assignment selected.")
    if st.button("Back to Assignments"):
        st.switch_page("pages/2_Assignments.py")
    st.stop()

st.title(f"📝 Rubric Builder - {assignment['title']}")

existing_rubric = api_request("GET", f"/rubrics/assignment/{assignment['id']}")

if "criteria" not in st.session_state:
    if existing_rubric:
        st.session_state.criteria = existing_rubric["criteria"]
    else:
        st.session_state.criteria = [
            {"name": "Content Understanding", "description": "Demonstrates understanding of key concepts", "weight": 0.4, "max_score": 100},
            {"name": "Argument Quality", "description": "Logical reasoning and evidence", "weight": 0.3, "max_score": 100},
            {"name": "Writing Clarity", "description": "Clear, organized, well-written", "weight": 0.2, "max_score": 100},
            {"name": "Citations/References", "description": "Proper use of sources", "weight": 0.1, "max_score": 100},
        ]

def render_criteria_editor():
    total_weight = sum(c["weight"] for c in st.session_state.criteria)
    
    st.subheader("Rubric Criteria")
    st.caption(f"Total Weight: {total_weight:.2f} / 1.00 {'✅' if abs(total_weight - 1.0) < 0.01 else '⚠️ Must sum to 1.0'}")
    
    for i, criterion in enumerate(st.session_state.criteria):
        with st.container(border=True):
            cols = st.columns([3, 2, 1, 1])
            with cols[0]:
                criterion["name"] = st.text_input("Name", value=criterion["name"], key=f"name_{i}")
                criterion["description"] = st.text_area("Description", value=criterion["description"], key=f"desc_{i}", height=60)
            with cols[1]:
                criterion["weight"] = st.number_input("Weight", min_value=0.0, max_value=1.0, step=0.05, value=criterion["weight"], key=f"weight_{i}")
                criterion["max_score"] = st.number_input("Max Score", min_value=1, value=criterion["max_score"], key=f"max_{i}")
            with cols[2]:
                st.write("")
                if st.button("🗑️", key=f"del_c_{i}"):
                    st.session_state.criteria.pop(i)
                    st.rerun()
            with cols[3]:
                st.write("")
                if st.button("⬆️", key=f"up_{i}") and i > 0:
                    st.session_state.criteria[i], st.session_state.criteria[i-1] = st.session_state.criteria[i-1], st.session_state.criteria[i]
                    st.rerun()
                if st.button("⬇️", key=f"down_{i}") and i < len(st.session_state.criteria) - 1:
                    st.session_state.criteria[i], st.session_state.criteria[i+1] = st.session_state.criteria[i+1], st.session_state.criteria[i]
                    st.rerun()

render_criteria_editor()

col1, col2, col3 = st.columns(3)
with col1:
    if st.button("➕ Add Criterion"):
        st.session_state.criteria.append({
            "name": "New Criterion",
            "description": "Description here",
            "weight": 0.1,
            "max_score": 100,
        })
        st.rerun()

with col2:
    if st.button("💾 Save Rubric", type="primary"):
        if abs(total_weight - 1.0) > 0.01:
            st.error("Weights must sum to 1.0!")
        else:
            payload = {"assignment_id": assignment["id"], "criteria": st.session_state.criteria}
            if existing_rubric:
                result = api_request("PATCH", f"/rubrics/{existing_rubric['id']}", json={"criteria": st.session_state.criteria})
            else:
                result = api_request("POST", "/rubrics", json=payload)
            if result:
                st.success("Rubric saved!")
                st.rerun()

with col3:
    if st.button("📥 Export JSON"):
        st.download_button(
            "Download",
            data=json.dumps({"criteria": st.session_state.criteria}, indent=2),
            file_name=f"rubric_{assignment['id']}.json",
            mime="application/json",
        )

st.divider()
st.subheader("Import Rubric")
uploaded = st.file_uploader("Upload rubric JSON", type="json")
if uploaded:
    try:
        data = json.load(uploaded)
        if "criteria" in data:
            st.session_state.criteria = data["criteria"]
            st.success("Imported!")
            st.rerun()
    except Exception as e:
        st.error(f"Invalid JSON: {e}")

if existing_rubric:
    with st.expander("Current Saved Rubric (JSON)"):
        st.json(existing_rubric)