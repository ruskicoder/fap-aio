1. it should be centered with max width of 98vw
The taskbar default state is extendedand cannot be collapsed
The taskbar when extended will have a height of 80px.The taskbar will have the layout as follows from lef to right:
- Page title buttons: [Weekly]/[Exam]. Positioned at the far left of the taskbar with the 2 buttons arranged vertically from top to bottom. Upon display, which schedule page will highlight the status (Ex: On weekly schedule page will highlight [Weekly] button, and vice versa for [Exam] button). Upon clicking on either button, it will navigate to the respective schedule page. The buttons will be contained in a div with width of 20% width (of the taskbar). 
- Center tile: The center tile will be centered with a width of 60% taskbar width. The contents of center tile is as follows:
  - Left side: Semester select. Drop down menu to select semester.
  - Middle: Slot counter. The middle section will be another div, with a width of 50% of the center tile. It will display: number of offline slots, number of online slots, total slots, and selected slots. The format will be as follows: "Offline: X | Online: Y | Total: Z | Selected: W | [Select all/Deselect All]" where X, Y, Z, W are the respective numbers. The text will be listed vertically, and centered. The final button is the select all slots and deselect all slots button.
  - Right side: Slot render: Same as page title buttons, there will be another div within the center tile, with width of 25% of center tile. 2 buttons [This week]/[This semester]. The buttons are placed vertically.Same function as before.
- Right side: Export buttons: There will be  large button [Export] on the far right of the taskbar, with width of 20% of taskbar. Nested in the export button on the right will be a triangle dropdown button. Upon clicking the triangle button, a dropdown menu will appear with 2 options: [Offline]/[Online]. If the user selected custom slots, the export button will export the custom selected slots. If no custom slots are selected, the export button will export all slots in the current semester. The dropdown menu options will allow the user to choose between exporting offline or online slots.

2. Trigger: A vertical tab on right edge of screen, width is 10px, with an arrow icon [<].
Drawer animation: slide from the right edge.
Drawer content: individual slot cards in the following layout:
- On top: 2 tabs [Offline]/[Online]. The tabs will be horizontally aligned. The selected tab will highlight the status. Upon clicking on either tab, it will switch to the respective slot cards.
- Below the tabs: A scrollable list of slot cards. Use current format, no change.

3. Replace the native FAP table with custom rendered grid using CSS grid/flexbox. Use the original layout of the table, but make it better by equal cells and responsive formatting
Responsive: for narrow screens, the grid will adapt to single column layout, with each slot card taking full width of screen. For wider screens, the grid will adapt to multi column layout, with each slot card taking equal width and height to fill the screen.
visual elements: color coding by subject. The cell format is as:
Top left: [Check box] | [Subject code] (bold), background color coded by subject
Top right: attendance status (present/absent), color coded (green/red)
the rest: as per original format
4. Yes. Checkbox at top left of each slot cell.

Behaviour: 
- Single click: select/deselect the slot. Selected slots will have a border highlight. Single click again will deselect the slot.
- Hold click: Select all slots of that subject. Hold click again will deselect all slots of that subject.
- Injected into the taskbar will have the select all and deselect all button as described.
- Users can use the right panel to select slots as a checklist view also. It should be synced with the grid view.

5. week&semester changing: Allow page to reload but save ui state from local storage (even on progress of scanning slots like in Weekly/Semester slot scanning function from current implementation)
-Persistence: As per original implementation, selected slots should persist across page reloads and navigation between Weekly and Exam schedule pages. The progress slide bar is positioned at the top of the taskbar, above all other elements. The layout will be: [progressbar]| [The rest of elements] stacked vertically.
6. Export workflow:
- Default (unselected) will export all slots in current semester. With dropdowns to either choose online slots or offline slots export.
- Upon selecting custom slots, export button will export only the selected slots. Dropdowns to choose online/offline slots still apply.
- File Format: [status]-[semester].ics

Status: Online/Offline/Custom
semester: semester code.

7. Primarily for desktop use. Responsive design for tablet and mobile also implemented with 30% right tab drawer becomes full width.

8. Follow current dark theme. Taskbar style elevation and shadow.
9. Keep emoji icons

Please continue to ask more questions if unclear.

continual of answer:

a. taskbar should expand in height when export happens, progress bar appears. to 100px of height.
When semester scanning is active, other controls should be normal but users are advised to not touch anything until scanning is complete.
b. when user holds for 1 second above, will trigger select all slots of that subject.
When user hovers above checkbox, there will be tool tips as follows: click to select, hold to select all of this subject.
After selecting all slots of a subject via hold-click, if the user single-clicks one of those slots, it should deselect just that one slot. This time the tool tip will show: click to deselect this slot, hold to deselect all of this subject.
c. the slot cards in the drawer also have checkboxes for selection
If a slot is selected via checkbox in the grid, it should be visually highlighted in the drawer's list (and vice versa) IF the current week view contains that slot, if not, no highlight in table.
the drawer cards should be listed chronologically (by date)
d. single column breakpoint: below the threshold between mobile and tablet screen width, around 600px.
multi column layout: It should maintain the original 7-day week grid as per original table. Every element layout should be identical.
If keeping week grid: Each row is a slot (Slot 1-8), each column is a day (Mon-Sun). With other layout keep original  (Like year and week selection)
e. color coding by subject:
the color should be randomly generated per subject (consistent across app)
colors should be stored in local storage for persistence
the cell background should be semi-transparent with the subject color, around 70% opacity.
f. calendar grid enhancement:
- The minimum cell height should be at least 20vh, at least divided by equal sections by 7 of the 80vh
- If a slot has lots of info (subject, room, meet URL, time), it should word wrap within the cell, and the cell height should auto expand to fit content, up to a max of 40vh.
g. taskbar semester select dropdown:
Native FAP web does not exist such. Retain all functions of original semester select dropdown.
When the user changes the semester, the semester export will export that semester. Nothing else. The semester select is purely for semester export. Retain all original logic. You must read the logic of the code before asking more questions.
h. export filename format:
If I select 3 offline and 2 online slots in Spring25, the export options should prompt user to select dropdown: [Offline]/[Online]/[All selected]. The result of the export should be: [Custom-Offline-Spring25.ics] or [Custom-Online-Spring25.ics] or [Custom-Spring25.ics] depending on user choice.
If user exports "All Offline" then "All Online", they should get all offline ics first, then all online ics. The dropdown only permits 1 options at a time. Users wanting both must do 2 exports using the dropdown select in that export button.
i. Navigation Between Weekly/Exam Pages:
what do you mean? It is just a simple <a> tag which redirects to that page. nothing else.
[Weekly]: https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx
[Exam]: https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx
Simple redirect. UI elements retain persistence via local storage as per original.
j. Drawer tab navigation:
Icon direction: When drawer is closed, show < (open). When drawer is open, show > (close)
Hover effect: it should glow on hover.
no keyboard shortcuts for now.