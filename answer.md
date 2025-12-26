1. an additional div at the top, below the user div, with width 100%,displaying: Total accumulated credits on the left, total GPA on the right, large font for numbers, color code by grade.
-It should have style normal
2. Keep chronological order of semesters
- Each semester block should be collapsible, with displaying semester name and GPA, expand reveals each averages of each subjects of that semester
- [term number] | [semester code] ([subject count]) | [semester GPA]
3. switch to table format with multipliers for each cell based on credit (ex (within the cell): [subject code] \n [avg] x [credit]) 
- suibjects should be color coded by grade range
4. grade color range:
.gpa-failed {
    color: #ff4444 !important;
}
.gpa-average {
    color: #ff9244 !important;
}
.gpa-good {
    color: #44aaff !important;
}
.gpa-verygood {
    color: #44ff44 !important;
}
.gpa-excellent {
    color: #ff44ff !important;
}
5. keep 10 color
6. Total gpa 3x size
- semester gpa 2x size than subject avg
-no need animation for now