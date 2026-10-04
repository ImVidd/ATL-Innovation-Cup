import streamlit as st
import requests
import pandas as pd
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

st.set_page_config(page_title="Results", page_icon="📊", layout="wide")

if "token" not in st.session_state:
    st.switch_page("streamlit_app.py")

assignment = st.session_state.get("selected_assignment")

if not assignment:
    st.warning("No assignment selected.")
    if st.button("Back to Assignments"):
        st.switch_page("pages/2_Assignments.py")
    st.stop()

st.title(f"📊 Results - {assignment['title']}")

grades = api_request("GET", f"/grading/assignment/{assignment['id']}")

if not grades:
    st.info("No graded submissions yet.")
    st.stop()

df_data = []
for g in grades:
    sub = g.get("submission", {})
    row = {
        "Student": sub.get("student_name", "Unknown"),
        "Student ID": sub.get("student_id", "N/A"),
        "Overall Score": f"{g['overall_score']:.1f}%",
        "Graded At": g["graded_at"][:10] if g.get("graded_at") else "N/A",
    }
    for cs in g.get("criterion_scores", []):
        row[cs["criterion"]] = f"{cs['score']:.1f}"
    df_data.append(row)

df = pd.DataFrame(df_data)
st.dataframe(df, use_container_width=True, hide_index=True)

st.divider()

col1, col2 = st.columns([2, 1])
with col1:
    st.subheader("Score Distribution")
    if len(df) > 1:
        scores = [float(r["Overall Score"].rstrip("%")) for r in df_data]
        import plotly.express as px
        fig = px.histogram(x=scores, nbins=10, title="Overall Score Distribution", labels={"x": "Score (%)", "y": "Count"})
        st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Export")
    csv = df.to_csv(index=False)
    st.download_button(
        "📥 Download CSV",
        data=csv,
        file_name=f"grades_{assignment['id']}.csv",
        mime="text/csv",
        use_container_width=True,
    )
    
    json_data = [g for g in grades]
    st.download_button(
        "📥 Download JSON (Full)",
        data=str(json_data).replace("'", '"'),
        file_name=f"grades_{assignment['id']}.json",
        mime="application/json",
        use_container_width=True,
    )

st.divider()
st.subheader("Individual Feedback")

selected_student = st.selectbox("Select student", df["Student"].tolist())
selected_grade = next(g for g in grades if g.get("submission", {}).get("student_name") == selected_student)

with st.container(border=True):
    st.metric("Overall Score", f"{selected_grade['overall_score']:.1f}%")
    
    st.write("**Criterion Breakdown:**")
    for cs in selected_grade.get("criterion_scores", []):
        with st.expander(f"{cs['criterion']}: {cs['score']:.1f}% (weight: {cs['weight']})"):
            st.write(cs["feedback"])
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("**Strengths:**")
        for s in selected_grade.get("strengths", []):
            st.write(f"✅ {s}")
    with col2:
        st.write("**Weaknesses:**")
        for w in selected_grade.get("weaknesses", []):
            st.write(f"⚠️ {w}")
    
    st.write("**Summary Feedback:**")
    st.info(selected_grade.get("summary_feedback", "No summary feedback"))