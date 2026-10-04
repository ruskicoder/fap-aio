access https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx

then

using user selection, determine the semester range:

[Season][year] Example: "Spring25"

Spring: 01/01 - 30/04
Summer: 01/05 - 31/08
Fall: 01/09 - 31/12

year is yy format with last 2 digits of the year Ex:: 2025 -> 25

### Weekly Schedule Flow
0. Determine semester range. only fetch weeks within semester range
1. select each week for fetching schedule:
    - Select year in div (example):
    <select name="ctl00$mainContent$drpYear" onchange="javascript:setTimeout('__doPostBack(\'ctl00$mainContent$drpYear\',\'\')', 0)" id="ctl00_mainContent_drpYear">
	<option value="2022">2022</option>
	<option value="2023">2023</option>
	<option value="2024">2024</option>
	<option value="2025">2025</option>
	<option selected="selected" value="2026">2026</option>

</select>
    - select week range in div (example):
    <select name="ctl00$mainContent$drpSelectWeek" onchange="javascript:setTimeout('__doPostBack(\'ctl00$mainContent$drpSelectWeek\',\'\')', 0)" id="ctl00_mainContent_drpSelectWeek">
	<option value="1">29/12 To 04/01</option>
	<option selected="selected" value="2">05/01 To 11/01</option>
	<option value="3">12/01 To 18/01</option>
	<option value="4">19/01 To 25/01</option>
	<option value="5">26/01 To 01/02</option>
	<option value="6">02/02 To 08/02</option>
	<option value="7">09/02 To 15/02</option>
	<option value="8">16/02 To 22/02</option>
	<option value="9">23/02 To 01/03</option>
	<option value="10">02/03 To 08/03</option>
	<option value="11">09/03 To 15/03</option>
	<option value="12">16/03 To 22/03</option>
	<option value="13">23/03 To 29/03</option>
	<option value="14">30/03 To 05/04</option>
	<option value="15">06/04 To 12/04</option>
	<option value="16">13/04 To 19/04</option>
	<option value="17">20/04 To 26/04</option>
	<option value="18">27/04 To 03/05</option>
	<option value="19">04/05 To 10/05</option>
	<option value="20">11/05 To 17/05</option>
	<option value="21">18/05 To 24/05</option>
	<option value="22">25/05 To 31/05</option>
	<option value="23">01/06 To 07/06</option>
	<option value="24">08/06 To 14/06</option>
	<option value="25">15/06 To 21/06</option>
	<option value="26">22/06 To 28/06</option>
	<option value="27">29/06 To 05/07</option>
	<option value="28">06/07 To 12/07</option>
	<option value="29">13/07 To 19/07</option>
	<option value="30">20/07 To 26/07</option>
	<option value="31">27/07 To 02/08</option>
	<option value="32">03/08 To 09/08</option>
	<option value="33">10/08 To 16/08</option>
	<option value="34">17/08 To 23/08</option>
	<option value="35">24/08 To 30/08</option>
	<option value="36">31/08 To 06/09</option>
	<option value="37">07/09 To 13/09</option>
	<option value="38">14/09 To 20/09</option>
	<option value="39">21/09 To 27/09</option>
	<option value="40">28/09 To 04/10</option>
	<option value="41">05/10 To 11/10</option>
	<option value="42">12/10 To 18/10</option>
	<option value="43">19/10 To 25/10</option>
	<option value="44">26/10 To 01/11</option>
	<option value="45">02/11 To 08/11</option>
	<option value="46">09/11 To 15/11</option>
	<option value="47">16/11 To 22/11</option>
	<option value="48">23/11 To 29/11</option>
	<option value="49">30/11 To 06/12</option>
	<option value="50">07/12 To 13/12</option>
	<option value="51">14/12 To 20/12</option>
	<option value="52">21/12 To 27/12</option>

</select>
    - upon selecting year + week, the page will reload to show schedule of that week.
2. Parse the schedule table for that week:
    - The table has days as columns (Mon to Sun) and slots as rows (Slot 1 to Slot 8)
    - Each cell may contain activity details or be empty (`-`)

    fetch from div:

    <table>
        <thead>
            <tr>

                <th rowspan="2">
                    <span class="auto-style1"><strong>Year</strong></span>
                    <select name="ctl00$mainContent$drpYear" onchange="javascript:setTimeout('__doPostBack(\'ctl00$mainContent$drpYear\',\'\')', 0)" id="ctl00_mainContent_drpYear">
	<option value="2022">2022</option>
	<option value="2023">2023</option>
	<option value="2024">2024</option>
	<option value="2025">2025</option>
	<option selected="selected" value="2026">2026</option>

</select>
                    <br>
                    Week
                    <select name="ctl00$mainContent$drpSelectWeek" onchange="javascript:setTimeout('__doPostBack(\'ctl00$mainContent$drpSelectWeek\',\'\')', 0)" id="ctl00_mainContent_drpSelectWeek">
	<option value="1">29/12 To 04/01</option>
	<option selected="selected" value="2">05/01 To 11/01</option>
	<option value="3">12/01 To 18/01</option>
	<option value="4">19/01 To 25/01</option>
	<option value="5">26/01 To 01/02</option>
	<option value="6">02/02 To 08/02</option>
	<option value="7">09/02 To 15/02</option>
	<option value="8">16/02 To 22/02</option>
	<option value="9">23/02 To 01/03</option>
	<option value="10">02/03 To 08/03</option>
	<option value="11">09/03 To 15/03</option>
	<option value="12">16/03 To 22/03</option>
	<option value="13">23/03 To 29/03</option>
	<option value="14">30/03 To 05/04</option>
	<option value="15">06/04 To 12/04</option>
	<option value="16">13/04 To 19/04</option>
	<option value="17">20/04 To 26/04</option>
	<option value="18">27/04 To 03/05</option>
	<option value="19">04/05 To 10/05</option>
	<option value="20">11/05 To 17/05</option>
	<option value="21">18/05 To 24/05</option>
	<option value="22">25/05 To 31/05</option>
	<option value="23">01/06 To 07/06</option>
	<option value="24">08/06 To 14/06</option>
	<option value="25">15/06 To 21/06</option>
	<option value="26">22/06 To 28/06</option>
	<option value="27">29/06 To 05/07</option>
	<option value="28">06/07 To 12/07</option>
	<option value="29">13/07 To 19/07</option>
	<option value="30">20/07 To 26/07</option>
	<option value="31">27/07 To 02/08</option>
	<option value="32">03/08 To 09/08</option>
	<option value="33">10/08 To 16/08</option>
	<option value="34">17/08 To 23/08</option>
	<option value="35">24/08 To 30/08</option>
	<option value="36">31/08 To 06/09</option>
	<option value="37">07/09 To 13/09</option>
	<option value="38">14/09 To 20/09</option>
	<option value="39">21/09 To 27/09</option>
	<option value="40">28/09 To 04/10</option>
	<option value="41">05/10 To 11/10</option>
	<option value="42">12/10 To 18/10</option>
	<option value="43">19/10 To 25/10</option>
	<option value="44">26/10 To 01/11</option>
	<option value="45">02/11 To 08/11</option>
	<option value="46">09/11 To 15/11</option>
	<option value="47">16/11 To 22/11</option>
	<option value="48">23/11 To 29/11</option>
	<option value="49">30/11 To 06/12</option>
	<option value="50">07/12 To 13/12</option>
	<option value="51">14/12 To 20/12</option>
	<option value="52">21/12 To 27/12</option>

</select>
                </th>

                <th align="center">Mon</th><th align="center">Tue</th><th align="center">Wed</th><th align="center">Thu</th><th align="center">Fri</th><th align="center">Sat</th><th align="center">Sun</th>
            </tr>
            <tr>
                <th align="center">05/01</th><th align="center">06/01</th><th align="center">07/01</th><th align="center">08/01</th><th align="center">09/01</th><th align="center">10/01</th><th align="center">11/01</th>
                
            </tr>
        </thead>
        <tbody>
            <tr><td>Slot 1 </td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>Slot 2 </td><td>-</td><td>-</td><td>-</td><td>-</td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1829923">EXE101-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=jmOwZiEmKIJEzdm9QtIGBw%3d%3d&amp;SessionNo=F9EHvqN%2bdUjlw7x5OhB%2faQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 419(<span class="label label-primary"></span>) - <a class="label label-default" href="https://meet.google.com/uyy-podq-sad" target="_blank">Meet URL</a><a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(9:30-11:45)</span><br></a></p></td><td>-</td><td>-</td></tr><tr><td>Slot 3 </td><td>-</td><td>-</td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819318">DCD301-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=fr3KzXP%2bAF%2bSw6YSLLpgTA%3d%3d&amp;SessionNo=F9EHvqN%2bdUjlw7x5OhB%2faQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(12:30-14:45)</span><br></a></p></td><td>-</td><td>-</td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819319">DCD301-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=fr3KzXP%2bAF%2bSw6YSLLpgTA%3d%3d&amp;SessionNo=TOzW%2b2PecME5SIRGC1cQKQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(12:30-14:45)</span><br></a></p></td><td>-</td></tr><tr><td>Slot 4 </td><td>-</td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819218">SWD392-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=XfkfEl1rYW3%2bJ2hWcAslTw%3d%3d&amp;SessionNo=F9EHvqN%2bdUjlw7x5OhB%2faQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(15:00-17:15)</span><br></a></p></td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819431">MIP201-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=nAF%2bJJI8arNCs4qRo6V3LQ%3d%3d&amp;SessionNo=F9EHvqN%2bdUjlw7x5OhB%2faQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(15:00-17:15)</span><br></a></p></td><td>-</td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819219">SWD392-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=XfkfEl1rYW3%2bJ2hWcAslTw%3d%3d&amp;SessionNo=TOzW%2b2PecME5SIRGC1cQKQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(15:00-17:15)</span><br></a></p></td><td><p><a href="../Schedule/ActivityDetail.aspx?id=1819432">MIP201-</a><a class="label label-warning" href="http://flm.fpt.edu.vn/gui/role/guest/ListScheduleSyllabus?subjectCode=nAF%2bJJI8arNCs4qRo6V3LQ%3d%3d&amp;SessionNo=TOzW%2b2PecME5SIRGC1cQKQ%3d%3d&amp;token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjVDNDIyRTg5NEE1QkQxOTAwQzI3NDVGMDE2RkRDRjI1IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY1NTI4OTgsImV4cCI6MTc2NjU1NjQ5OCwiaXNzIjoiaHR0cHM6Ly9mZWlkLmZwdC5lZHUudm4iLCJhdWQiOiJodHRwczovL2ZlaWQuZnB0LmVkdS52bi9yZXNvdXJjZXMiLCJjbGllbnRfaWQiOiJmYXAtc2VydmljZSIsInN1YiI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsImF1dGhfdGltZSI6MTc2NjUzNzQ3MywiaWRwIjoiR29vZ2xlIiwiQ29uc2VudEdpdmVuIjoidHJ1ZSIsInVzZXJJZCI6ImU3MmY2NTI3LTAzZjgtNGZiOS1iNGM3LTc2MzM2YTQ1M2E0NSIsInVzZXJUeXBlIjoiU3R1ZGVudHMiLCJlbWFpbCI6Imtob2Fkbzc1NzdAZ21haWwuY29tIiwicGhvbmVfbnVtYmVyIjoiMDc4Mzc1OTk3MSIsInJvbGUiOiJGQVBGUFRVIFN0dWRlbnRzIiwidXNlcm5hbWUiOiJraG9hZG83NTc3QGdtYWlsLmNvbSIsImNpdGl6ZW5DYXJkSWQiOiIwNzkyMDUwMjY0OTUiLCJjYW1wdXNJZCI6IjE4ODVlN2M5LWU4NjEtNGEyMy05N2M1LWQwM2U5OGZjZGY3NiIsImNhbXB1c0NvZGUiOiJIQ00iLCJwcm9qZWN0Q2FtcHVzZXMiOiJbe1wiUHJvamVjdENvZGVcIjpcIkZBUFwiLFwiUHJvamVjdElkXCI6XCJjYjM4NzNlNS1kMTA4LTRmNDgtODM2ZC1mMjU3ZTk1MzM2NjFcIixcIkNhbXB1c0lkXCI6XCIxODg1ZTdjOS1lODYxLTRhMjMtOTdjNS1kMDNlOThmY2RmNzZcIixcIkNhbXB1c0NvZGVcIjpcIkhDTVwiLFwiUHJvamVjdFVzZXJJZFwiOlwiXCIsXCJSb2xsTnVtYmVyXCI6XCJTRTE5MjM1N1wiLFwiSXNBY3RpdmVcIjp0cnVlfV0iLCJqdGkiOiI4MTUyOTZCNkI0MzE5NUVENjRGNzhCMUYzNjc2QTEyNSIsInNpZCI6IkNDMDM1RDkyODkyNTFENjE3RUNGN0YzQUUxRDE2OEI0IiwiaWF0IjoxNzY2NTUyODk4LCJzY29wZSI6WyJvcGVuaWQiLCJwcm9maWxlIiwiZW1haWwiLCJpZGVudGl0eS1zZXJ2aWNlIl0sImFtciI6WyJleHRlcm5hbCJdfQ.cf5tTCP_3OdG-slvuccxxSquV6_TMFZLSmegPM35GpBcIFhpo0FGwUu1pFl3b8fXXZS-JfAsiwk9qnwWONRc1d9qIOSxkpJ-Ybe0lsdDIGq02B__7jUTGV6rOfjkaCGfdt8s80UPrS3EIuT4Zjr2HBfV1POS6kal_XpKuzNFGlW2gwhxdYdtXbcP26Ta2_rVcQ0YtUBA4-juP1_5OiG5Z2csbY4xeo6lruwGQqD4299oQX__2JI81IpI1RDAFrsjYio_FbIjq-mvdwxWSgZ6-DZWc9zT-bnDXce3T89W4aL4BEHUhSKJyrkYYR6jAQqhbh1QaRIz5whvl44kVOAZ6w" target="_blank">View Materials</a><br> at NVH 614(<span class="label label-primary"></span>) <a> <br>(<font color="red">Not yet</font>)<br><span class="label label-success">(15:00-17:15)</span><br></a></p></td><td>-</td></tr><tr><td>Slot 5 </td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>Slot 6 </td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>Slot 7 </td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>Slot 8 </td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>
        </tbody>
    </table>

    - Save the schedules in localstorage before moving to next week

3. Repeate 1 and 2 until all weeks are processed in the semester.

4. Compile all the weekly schedules and export to ics format.

Note: The extension must cycle through each week and fetch data. This is fundamentally different from exam schedule.
 