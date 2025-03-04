# How to use HelpMe

## General

### What is this system? And what are the major features of it and why should I use it?

This is the HelpMe course help system. It is an education system designed to help alleviate some of the painful parts of managing courses.
Using HelpMe does not cost anything and is completely free (it is primarily developed by students from UBC Okanagan).

There are 3 main features of the system:
- Queues
- Course Chatbot
- Anytime Question Hub

**Queues**: This is essentially a virtual queue. Some of the use cases where this can be really useful is for online/hybrid office hours/labs, or for really busy in-person labs (where there can be 3+ more students with their hand up at one time). 

Some of the benefits include:
- data collection (so professors know what questions are being asked or what TAs don't check-in or answer questions or what sessions are the busiest)
- fairness (staff can pre-assess and prioritize high-priority questions, staff can see how long students have been waiting and prioritize ones that have been waiting a while, and selfless students can feel more comfortable asking questions without worry that they will take time away from other students)
- students don't need to hold their hand up (for in-person)
- improved organization (especially for virtual/hybrid sessions)

Additionally, for the use case where students have to do demonstrations and have items that need to be checked off (e.g. in a chemistry lab that has multiple parts to the experiment that need to be looked at before they can continue) the professor can set an assignment ID and create tasks, which will allow students to create either a regular question or a demo for what tasks they want checked off.

**Course Chatbot**: Unlike something like ChatGPT, this course chatbot allows professors to upload their course documents (e.g. syllabus, lab files, slides, etc.) which the chatbot can then use and cite when students ask it questions using a sophisticated RAG system. 

Additionally, staff members can see what questions are being asked to gauge student understanding which can help professors improve their courses, which is data that would otherwise be lost if they use something like ChatGPT.

Lastly, if the student is not satisfied with their chatbot answer, they will have the option to convert it into an anytime question to get human help.

This course chatbot is also fed the text from the user guide, meaning that you should be able to ask it questions regarding the system.

**Anytime Question Hub**: Students can post questions here, get an immediate AI answer, and can then say if they are satisfied or not with their answer, which will send an email notification to all staff signed up for it that there's a new question and can come and answer it. You can think of it like an "email 2.0". It becomes especially useful for classes with large amount of students, notably because unlike email, any TA can answer the student. Initially only the student that created the question and staff can see the question, but if a staff member likes the question enough, they can make it public so that any student can see it (but the student will still remain anonymous). 

Note that professors can turn off any of these major features in the course settings.

### How can I navigate/go to X page? 

- First you should know there are two "levels" of navigation:
  - Organization "level" - Shows all the courses you have access to in this organization
    - If you are a professor, you can create a course from this page
  - Course "level" - This is likely where you are, as this is where most of the features are (including the course chatbot)

If you are on desktop, at the top of the page will be the navbar. On mobile, there is a hamburger menu at the top right of the screen that will show the nav menu.

The navigation elements are as follows:

- Course Page (will show the name of the course in bold e.g. "**COSC 304**"): Usually the first page you are on. You are likely here or on a queue page.
- Queues: Has a dropdown menu that shows all of the queues in the course. 
- Anytime Qs: Takes you to the Anytime Question Hub page
- Schedule
- Course Settings (staff-only)
- Insights (professors-only)
- My Courses: Takes you up a "level" back to the organization level with the "my courses" page
- "Your Name": Appears at the top right of the navbar on desktop. Upon hovering, it will show a dropdown menu that will give you the option to go to the profile settings page or to logout. On mobile, this appears at the bottom of the nav menu and logout is also at the bottom of the nav menu rather than a dropdown.

### What are on all the pages? ("course" level)

- **Course Page**: 
  - On the course page on the left side there is a list of queues with a list of which staff are checked into each queue (a queue with checked-in staff have an animated border). 
  - Just below this list of queues there is a card that takes you to the Anytime Question Hub. 
  - And just below that is a graph that shows estimated wait times at various times at various times of the week. 
  - On the right side of the course page, depending on how the professor customizes it, there will either be a window for the course chatbot or a condensed view of the schedule. If you see the schedule, at the bottom-right corner of the page there will be a little "Chatbot" button that also opens up the course chatbot. 
- **Queue Page**: 
  - On the left side of the page (on desktop) is the Queue Info Column, which looks different for staff and students. This column gets transformed to be at the top of the page on mobile. The breakdown for what this column has for staff and students is as follows:
    - Staff:
      - Queue name
      - Queue Type (Online, Hybrid, In-Person)
      - Queue status (is it up-to-date)
      - Checkin/Checkout button
      - Edit Queue Details button
      - Add Students to Queue button
      - View Students lab Progress (only if the queue has an Assignment ID set)
      - StaffList (shows all staff currently checked in as well as their status and who they are helping (shows as anonymous student for other students))
      - Clear Queue button (in Edit Queue Details popup modal on mobile)
      - Delete Queue button (in Edit Queue Details popup modal on mobile)
    - Students:
      - Queue name
      - Queue Type (Online, Hybrid, In-Person)
      - Queue status (is it up-to-date)
      - Join Queue button (shows as "Create Question" if queue has an Assignment ID set)
      - Create Demo button (only if queue has an assignment ID set)
      - StaffList
  - The rest of the page is filled with a list of questions from top-to-bottom. If your a student just above the questions is the list of your questions and their status (as well as an option to edit it or finish creating it or to rejoin the queue), and if you're staff just above the list of questions is all the questions that you are helping. Each question is a long rectangular white card, and the differences for what they look like for staff and students are as follows:
    - Staff:
      - It will show who asked the question (name and profile picture), the question text, and question types
      - It shows where the student is attending (online or in-person, this is only for hybrid queues)
      - It will show how long the question has been helped for and how long they were waiting
      - If the question is in the queue (not being helped), there will be buttons:
        - to start helping the student (a blue circle with a "play" icon)
        - to ask the student to rephrase their question (a yellow circle with a question mark)
        - and to remove the question from the queue (a red circle with a trashcan icon). Note that when a student is removed from the queue, they will have the option to re-join the queue with the same question (but at the bottom)
      - If the question is being helped, there will be buttons:
        - to pause helping the question (a gray circle with a "pause" icon)
        - to finish helping the question (a green circle with a checkmark)
        - to say you "Can't Find" a student (a red circle with an X). When you click this, the student will receive a prompt telling them they were not found with the option of either leaving the queue or rejoining the queue in the spot they were at before (highest waitTime questions are at the top). The waitTime of the question will not go up when they are in this "Can't Find" state.
        - to "Requeue" a student (a white circle with an arrow in a circle). When you click this, the question will be put in a "Not Ready" state and will appear "gray-ed out" in the queue. Once the student is ready, they can click the blue "Rejoin Queue" button and they will appear back in the queue as normal once ready. The waitTime of the question will not go up when they are in this state.
    - Students:
      - It will show the question text and question types, but not show who asked it (thus remaining anonymous).
      - Your question card will have a green gradient if it is yours.
      - Your question card may be yellow if the staff member has temporarily "paused" your question.
      - It will show how long the question has been helped for and how long they were waiting
      - It will show the status ("Being Served", "Paused", or "Not Ready")
      - If the question is still being drafted (in an unfinished state), the question card will have "Unfinished Question" in larger text on the question card.
  - Once a student is helped, a popup modal will show telling the student that they are now being helped. If the queue is online (or hybrid and the question is online), the student will be told to join the zoom meeting via the link set in the Edit Queue Details popup modal.
  - There is also a little "First In First Out"/"Tag Groups" toggle at the top-right that will either show the queue as a regular FIFO queue or to group all the questions by their tag (default is FIFO), and this can be useful if you want to say answer all the "Part 4" questions before the "Part 3" questions of your lab, that way you can keep your mind in the same mindset to help questions faster. Students can also be on "Tag Groups" mode, allowing them to just 1-click join a tag group. These two views (and the default view) can be modified in the queue config.
  - At the bottom-corner of the page is a little "chatbot" blue button which will open up the chatbot modal
- **Anytime Qs**/**Anytime Question Hub Page**:
  - On the left side of the page is a blue button to "Post Question". Clicking this will open a popup modal asking for the question abstract (short summary), the question text, and the categories the question falls under (question tags). Once posted, students will immediately get an AI answer and can choose whether or not they are satisfied with said answer, in which staff will be notified to come give a human answer.
    - Note that staff also have the option to do this so that they can better learn the system or for their own demonstration purposes. It's not really intended to be used by staff.
  - For staff, there is also a white "Settings" button that will open a popup modal to add question tags for future anytime questions.
  - At the top of the page are buttons and selectors for filtering the questions if verified/unverified, visible/hidden, and by any question tags, or to sort by newest, oldest, most or least votes.
  - On the main content on the page are a list of anytime questions. Each anytime question card has the following details:
    - Who asked it (appears as "anonymous student" for other students)
    - How long ago they asked it
    - The question's upvote total (with an upvote and downvote buttons)
    - The question abstract in bold, and the question text beneath that
    - The question's answer (initially it is AI, but can be modified or completely rewritten when a staff clicks "Post Response"). Note that you may need to click on the question card to expand it
    - A little tag at the top-right showing whether it is private or public (private questions can only be seen by staff and the question creator. Other students can see public questions but not who posted it). 
    - Another little tag at the top-right showing if the question is "Human Verified", "AI Answered, Needs Attention", "AI Answered, Resolved", or just "AI Answered" (it may also say "Awaiting Answer" if the answer text is blank). 
    - A red circle button with a trashcan icon to delete the question (located top-right of card or inside the "Post Response" modal)
    - A white button with a pencil to edit the question (located top-right and only for students)
    - A blue button with a pencil and paper to "Post Response" (located top-right and only for staff). 
  - For the "Post Response" modal, you can edit the answer text, set the question to be visible to all students (they will still appear anonymous). You can also click "Mark as verified by faculty" which will add a little green checkmark beside the "Human Verified" tag.
- **Schedule Page**:
  - For students, this page can be viewed to see what times certain events are (such as lab/office hour times or what TA is in at what times)
  - For staff, here you can create recurring or one-time events. You can also assign staff to these events so they get prompted and auto-checked out when the event ends (strongly recommended). You can click and drag on the calendar to create an event or you can click the "Add Event" button at the top-right.
  - At the bottom corner of the page is a little "Chatbot" blue button which will open up the chatbot modal
- **Course Settings** (staff-only):
  - General Settings (professor-only)
    - Can customize the course name, coordinator email, section group name, course-wide zoom link, timezone, semester, and professors
    - Can toggle course features (hover the little "?" icon for more details about these):
      - Anytime Question Hub
      - Anytime Question Hub AI Answers
      - Chatbot
      - Queues
      - Schedule on Front/Home Course Page (off by default)
    - Course invite link (with option to print to QR code). Can clear it if you don't want new students to join the course.
    - A button to archive the course
  - Course Roster (professor-only)
    - Shows a list of everyone in the course (name, email), grouped by their roles
    - Has an option to remove a user from the course or to change their role (note that promoting someone to a professor here does not automatically make them an organization professor, meaning that they won't be able to create their own courses. Contact an admin if you wish for them to be added as an organization-level professor).
  - LMS (Learning Management System) Integrations (professor-only)
    - Lets you link up your course with Canvas, allowing you to verify which users in your HelpMe course match the users in your Canvas course (goes by the student's name)
    - Will have more integrations in the future, like auto-feeding in course documents/discussions into the chatbot or Anytime Qs
  - TA Check In/Out Times (professor-only)
    - Lets you see a calendar of when certain staff checked in and how many students they helped
  - Queue Invites (professor & TA)
    - Lets you create invites to specific queues. These invites will show what staff are checked in and how many students are in the queue before they log in. Staff can also go to this queue-invite page and display it on a projector with the QR code visible.
    - There are a few presets of customizations for these queue invites that you can pick from (Default, Office Hours, Projector, Help Desk)
    - Like the course invite, you can also print the QR code for these invites
    - Read all the little "?" help icons if you need more help
  - Edit Queue Questions (professor & TA)
    - Shows a list of all queue questions and lets you edit them, search them, or sort them.
    - Each question shows who asked it, who helped them, the status of the question, the tags of the question, when it was created, and the question text.
  - Export Data (professor & TA)
    - Has options to export the queue questions to a CSV or to export all the students' assignment progress to a CSV
  - Chatbot Settings (professor & TA)
    - Access chatbot settings (model, initial prompt given to chatbot)
    - Add/Edit/Delete course documents given to the chatbot 
  - Chatbot Document Chunks (professor & TA)
    - All uploaded documents given to the chatbot are "chunked" into pieces that the chatbot can then view and reference in questions. This is where you can view/edit said pieces.
    - You can also directly add new document chunks here
  - Edit Chatbot Questions (professor & TA)
    - Here you can view all chatbot questions that have been asked. You can search questions, sort them, and filter them.
    - Each question has the question text, the chatbot answer, the source documents, whether or not it is staff-verified, and whether or not it is suggested. 
    - You can also edit or delete these chatbot questions here (marking a question as suggested will make it show up whenever someone starts a new chat with the chatbot)
    - You can also insert the chatbot question into the DocumentStore, which will treat the question as a new course document that can then be cited in future questions
    - You can also add new chatbot questions here
- **Insights** (professor-only):
  - Here you can view a variety of graphs constructed out of the data collected, including statistics like how many questions were asked, what times were the most busy, or when the system is most often used.


## Student FAQ

### How to create a question / join a queue / create a ticket

Note that "question" can mean 3 different things on this system. There are queue questions, chatbot questions, or anytime questions, and they are all very different.

For queue questions:
1. You must be on a queue page with checked-in staff
2. If you are on desktop, there will be a blue button at the top-left that says "Join Queue". If you are on mobile, there will be a big blue button that says "Join Queue" near the top or middle of the page.
3. From there, you will get a popup modal to create the question and can now enter your question's text and any question types. Once done, click "finish"
4. From there, you will see a blue banner which shows all of your current questions, their statuses (e.g. if it's unfinished or currently being helped), and the position of the question in the queue. Just below this blue banner is a list of all questions in the queue, and your question is highlighted green. 
5. Once the staff member starts helping you, either you will go to the staff member or the staff member will come to you (or if it's online/hybrid, you will need to join the Zoom or Teams meeting. You should get a popup modal with a link you can click to do so). 

For chatbot questions:
1. If you are on the course page, there should be a big chatbot window where you can ask chatbot questions. Otherwise, there is a little blue "Chatbot" button at the bottom-corner of the screen on most pages that you can chat with.

For anytime questions:
1. You must be on the Anytime Question Hub page (can click the "Anytime Qs" on the navbar). There, you should see a large blue "Post Question" button that you can click.
2. From there, you can fill out the question abstract (which is just a short summary of what your question is or about, kind of like an email subject line), the question text, and any categories that the question falls under (if the professor has created any question tags).
3. Then, click finish. You will immediately get a response from the course chatbot AI, which you can then say if you are satisfied with that answer or if you still need faculty help. If you click "Still need faculty Help" it will automatically email any professors and TAs (if they have signed up for emails) to come and give you an answer (or modify the response so that it is correct). 

### Help I can't create a question / join a queue / create a ticket

Note that "question" can mean 3 different things on this system. There are queue questions, chatbot questions, or anytime questions, and they are all very different.

For queue questions:
1. Double check that you are in a queue with staff in it
2. You may already have a question either in this queue or another queue. What likely happened is you accidentally closed the "Create Question" popup modal while you were drafting/creating your question. There should be a round pulsating button that you can click/tap to finish creating your question.
3. If it's none of these things, feel free to report it to adam.fipke@ubc.ca

For chatbot questions:
1. This is likely a bug if you can't create a chatbot question, feel free to report it to adam.fipke@ubc.ca

For anytime questions:
1. This is also likely a bug if you can't create an anytime question, feel free to report it to adam.fipke@ubc.ca

### Will other students be able to see my questions?

- For queue questions, no all questions are anonymous for other students. Only TAs and professors can see who asked the question
- Likewise, for the anytime question hub, all anytime questions are also anonymous to other students. Only TAs and professors can see who asked the question. 
  - When you first create an anytime question, only you and staff can see it. Staff then have the option to post the question publicly so that other students can see the question, but don't worry! You will still appear as an anonymous student.

### When is X?

Check out the schedule page! If the professor has set it up, those dates should be set there. Otherwise, you can ask the chatbot, and if the professor has uploaded the syllabus, the chatbot should be able to retrieve the dates from there.

### Can you check my work / mark/grade my lab / help me?

To get help from a TA, join a queue with staff checked in and they will help you. Otherwise, try posting your question on the Anytime Question Hub, where you will immediately get help from an AI and if you're not satisfied a TA or professor can come and help you.

### What is the zoom link?

Once you start getting helped, a popup modal should show with a link to the zoom meeting. Otherwise, it may be posted in the queue notes on the top left side of your screen (desktop) or near the middle (mobile).

## Staff FAQ

### How do I get started as a professor?

1. First, you need permissions. Before you can get permissions, you need to [create an account on HelpMe](https://coursehelp.ubc.ca/login) (if you are coming from UBC, I recommend you login with UBC). You will also need to contact Dr. Ramon Lawrence at ramon.lawrence@ubc.ca that you are interested in using the system and that you have created an account, and he can elevate you to a professor position and possibly help create a course for you. If you need some quicker help regarding HelpMe, you can also contact Adam, who is an active developer of the system, at adam.fipke@ubc.ca
2. Once logged in, you should be on the "My Courses" page. If you already have a course page, great! Click on that. Otherwise, you will need to create a course with the blue "Add New Course" button on the right. From there, you should be able to fill in the fields and click "Add course" (don't forget to add yourself as a professor!)
3. On the course page, you can create queues (the button to do so is located just below the anytime question hub card). You can hover the little "?" beside each field for more help. You can also load one of the example queue configs to see how a queue could be set up. Note that all the settings listed here and more can be changed on the queue page under "Edit Queue Details". Once you have your queues set, it is recommended to go into them and to modify their question types under the same "Edit Queue Details" button.
4. You will now want to modify your course invite link and share it so that students can join your course. To do so, go to the "Course Settings" tab and under "General Settings" modify the Course Invite Link code to something of your choosing, click the big blue "Update Invite Code" button, and then copy the link and share it with your students. Additionally, you can create Queue Invites under Course Settings -> Queue Invites and these are essentially the same as the course invite except they will send the student directly into the queue (instead of the course page) and will also display a preview of the queue (how many students are in it, any checked in staff) before the students log in (allowing them to preview how busy the queue is before needing to login). You can also click "Print QR Code" to print a QR code of this invite that you could then post outside your office (especially useful for busy hybrid office-hours). The professor can also go onto the queue invite page, and upon clicking a little blue switch at the bottom of the page, will show a QR code, which you can then show on a projector screen so that students can just scan the QR code to join the queue (useful for in-person labs).
5. Once someone joins the course, you can view them under Course Settings -> Course Roster. For your TAs, they must first join the course (their role will default to student), and then you can promote them to the TA role under this page.
6. Once you have all your TAs in your course, it is recommended you go into the Schedule page and add events (probably recurring) for your office hours and labs. It is strongly recommended to assign staff members to said events, as they will get auto-checked out when the event ends (which will also prompt any leftover students whether they would want to leave or stay when the last TA leaves, essentially cleaning the queue which is important for data collection insights). You can assign yourself to said events too, to save you the need to remember to check out.
7. You can customize the chatbot under Course Settings -> Chatbot Settings. Here you can adjust what LLM model is being used, the initial prompt (it is recommended to adjust this and say what the course is and some learning outcomes and how you want the chatbot to respond (e.g. don't just give the answer, try to give hints to help their understanding)), top k (the max number of documents that the RAG system will retrieve), similarity threshold (how relevant the document must be to be retrieved by the RAG). The most important part here is this is where you can upload your course documents (syllabus, slides, lab manuals, assignments, etc.). Any documents uploaded here will be "chunked" into pieces and cited when the users ask the chatbot questions. You can view/modify the chatbot chunks under "Chatbot Document Chunks". You can also view/modify users' chatbot questions under "Edit Chatbot Questions". The reasons why you would want to modify a chatbot question is it may be asked again in the future and you can mark a question as "Suggested" which will be shown as a suggested question in chatbot windows.
8. The anytime question hub does not need much customization, but you can give it question tags under "Anytime Qs" -> "Settings"
9. Lastly, you may want to sign up for notifications by going under "Your Name" -> "Profile" -> "Notifications" -> enable Browser Notifications and Email Notifications of your choosing.

### How to check-in or check-out of the queue? Why require check-ins?

Staff must first check-in to a queue before students can create any questions. To check-in, you can click the blue "Check In" button near the top of the course page or click the blue "Check In" button on the left column in the queue page. 

Having staff check-in to the queue helps show students which queues actively have staff servicing them and also prevents students from joining the queues hours or days beforehand. 

### How can I edit a queue? What are all the options that I can edit for a queue and what do they all do?

You can edit a queue by going to the corresponding queue page and clicking "Edit Queue Details". A popup modal will show with a lot of settings that you can customize. Once done, click the blue "Save Changes" button at the bottom.

**Queue Type**:
- Online: The queue is online-only. Students will be prompted to click on the zoom link once helped.
- Hybrid: Students can join the queue either online or in-person. They will be given the option to select if they are joining online or in-person. If they are joining online, they will be prompted to click on the zoom link once helped.
- In-person: The queue is in-person only. There is no prompt to click on the zoom link once helped.

**Queue Notes**: These are notes that are displayed under the queue cards on the course page and also on the queue page. Please do not make them very long since they could take up considerable room on mobile for students. Some examples of what you could put here: lab name, lab section, physical room location, any announcements, links to external resources, a mix of these, or any other details

**Question Tags**: Students are able to select 0 to many tags when they create a question. This data is collected and can be useful for question insights (e.g. "oh there were a lot more questions for Lab 8 compared to Lab 9", and then you can go under "Course Settings" -> "Edit Questions" to see what questions were being asked for Lab 8). When creating a question tag, you can click on the colour square to modify the colour of the tag (it is recommended to make similar tags the same colour but with different shades. E.g. Lab 9 is a slightly darker shade of blue than Lab 8). You can modify the minimum number of question tags the student must select with the "Minimum Question Tags" setting.

**Assignment Id** and **Tasks**: The assignment ID for the queue (e.g. "lab1", "lab2", "assignment1", etc.) is used to track the assignment progress for students. Only set if you want to define tasks to keep track of. Note that you can edit this assignment ID freely without worry that any existing data will be modified. Student assignment data will only be modified when a question is done being helped. A task is similar to a tag except it is 'check-able'. For example, a lab may have many parts or questions that require a TA to look at before the end of the lab. Students will then be able to Create a Demo which you can then help and select which parts to mark correct. Each task has an ID, a Display Name, a Short Name, whether or not it is Blocking, its Color, and its Precondition. You can hover the little "?" beside each to see what they do.

**Queue Config JSON**: This is essentially an export of all your queue settings. You can then save this externally, modify it (optional), and copy-paste it into another queue to immediately have everything set how you want it to. This can be useful when setting up a new semester or if you want to quickly swap one lab's queue config JSON with another to view student's lab progress of the old lab. 

### What are the roles of the system?

There are two "levels" of roles in HelpMe.

For organization-level roles, there are:
- User
- Professor
  - Main difference is between this and the User role is Professors can create courses
- Admin
  - Has access to the Organization settings panel

For course-level roles, there are:
- Student
  - Can create queue questions, chatbot questions, and anytime questions, and also modify their profile or see the schedule
- TA
  - Can answer queue questions, verify chatbot questions (under Course Settings page), and give human answers/verify anytime questions.
  - Can check-in and check-out of queues, and edit queue details (and edit the anytime question hub), and manually add students to the queue. 
  - Cannot create queue questions, but can still make chatbot questions or anytime questions (for demonstration or testing purposes)
  - On the course settings page, can create/modify queue invites, edit student's queue questions or chatbot questions, or edit settings of the chatbot
- Professor
  - Same as a TA but with even more permissions
  - Has access to more items on the Course Settings page (e.g. the course roster, the TA check-in check-out times, general course settings (which includes the course name, course-wide zoom link, the course feature toggles, the course invite link, and a button to archive the course))
  - Has access to the Insights page

Colloquially, anyone with a course-level role of TA or Professor is known as a "staff" member (and staff does not mean developer/customer service of the system).

### What is the schedule page? Why is it here?

The schedule page lets you create events. These can be one-time events or recurring events. You can either click and drag on the schedule page to create an event or click the "Add Event" button at the top-right.

The main advantage to creating events is you can assign your staff members to these events, which will cause them to auto-checkout once the event ends (saving you the need to remember to checkout). It is **strongly** recommended to do this at the start of your course.


### What is student assignment progress?

So in HelpMe there exists a feature under the "Edit Queue Details" modal where you can assign an assignment ID of your choosing to a queue as well as tasks for your students to complete (students will have the option of creating a "Demo" in which you can check off which parts they got done). On a queue page, there is an option to "View {assignment_ID} Progress" which will show every students' progress so far in the assignment that you have created. Under Course Settings -> Export Data there is an option to "Export CSV of all students' assignment progress".

The idea behind the feature is how in some labs there may be parts that require the TA to come "check-off" at some point before they leave the lab (e.g. chemistry/engineering/physics lab experiment). When a student is ready to have a part of the lab ready to be checked off they can create a "Demo", which is in the same queue as regular questions but can be differentiated and prioritized. Once you are helping them, you can select what parts they have finished, and that gets stored as "student assignment progress". You can think that each "task" may be a part of the lab that needs to be checked off, and any tasks that need to be looked at *before the student can continue working on the lab* are considered "Blocking Tasks" (by default, a task is not blocking, meaning that students can enter the queue with tasks 1, 2, and 3 all ready to be checked). This feature is totally optional.

There is currently **no** integration made between the LMS (Canvas) integration assignments and these assignments. From synchronizing your LMS system (Canvas), your assignments descriptions will be automatically uploaded to the Course Chatbot, which can then be queried when the students ask the chatbot questions. But this LMS feature currently has nothing to do with student assignment progress and are completely separated systems.
