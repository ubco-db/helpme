## Version 1.3.0 - Feb 05, 2025

#### New Features
- ***General***
  - Added a new "System" Chatbot toggle, allowing you to ask any questions or feedback regarding the HelpMe system 
  	- By default, it will still be in "Course" mode, which will query uploaded course documents as before
  	- HelpMe developers will frequently be looking at these System Chatbot questions to improve the system and Chatbot
    	- So if you notice that the answer was not accurate, try asking it again in a couple days, it may be better!
- ***Staff-only***
  - Fixed and completely overhauled the Learning Management System (Canvas) integration
  	- Professors can now link their Canvas courses with HelpMe, allowing:
  		- Professors to synchronize assignments (descriptions) and announcements to the HelpMe course chatbot
  		- Professors to compare and see which students is in your HelpMe course and not your Canvas course (or vise-versa)

#### Improvements
- Adjusted and improved tooltips under Chatbot Settings and Export Data (under Course Settings)


***

## Version 1.2.3 - Feb 02, 2025

#### New Features
- ***General***
  - On the course page, you can now see if you have any unread Anytime Questions
- ***Staff-only***
  - Added sorting on the Assignment Report modal
    - can now sort by date, student ID, and name
  - Staff now have the option to add students to the queue with a demo (only works with queues with an assignment ID)

#### Improvements
- Reworked how question text is truncated on question cards. You now click to expand the question card. This also fixes an issue where sometimes the question text tooltip would not show up and thus the full text could not be read
- Fixed an issue where the "Join Zoom Now" modal would not go away once done helping
- Misc bug fixes and improvements

***

## Version 1.2.2 - Jan 19, 2025

#### Improvements
- Fixed a bug where end date would appear as "Invalid Date" when creating repeat events
- Fixed this modal being very thin on some browsers
- Fixed bug where verifying your email would not work when manually typing in the code
- Hopefully fixed issue with randomly being logged out
- The insights page now shows all insights by default
- Misc bug fixes and improvements


***

## Version 1.2.1 - Jan 15, 2025

#### New Features
- ***General***
  - Users using the chatbot now have the option convert their question into an Anytime question
    - This is useful if the chatbot gave an unsatisfactory answer, as a staff member can then review the Anytime question

#### Improvements
- Staff can now create anytime questions 
  - While this isn't really intended, this was enabled so that staff can better learn the system or if they want to demo the system to students
- Fixed a bug where all anytime questions would be marked as "Human Verified" even if the staff member did not modify the answer nor clicked the box to mark it as staff verified
- Fixed a bug where the "Check In" button on the home course page did not work

***

## Version 1.2.0 - Jan 11, 2025

#### New Features
- ***General***
  - When the last TA checks out of a queue, students with questions will now be prompted whether they would like to leave the queue or stay
    - If they don't respond in 10 minutes, the question will automatically be closed
- ***Staff-only***
  - Staff can now be assigned to events (on the schedule page)! When you do so, said staff will be prompted to check-out of the queue when the event ends (they can select if they need 10 more minutes). 
    - It is now ***strongly*** recommended that professors set this up as this will solve the problem of TAs forgetting to check out. 
  - Added LMS integration (currently just supports Canvas)
    - Currently, this just allows you to verify if students in your HelpMe course are the same as the ones in your Canvas course, but will be expanded in the future
    - You can access this on the Course Settings page

#### Improvements
- When you create a recurring event, it will temporarily save what you made the end date and make it so your next events you create are automatically set to this end date (this should speed up creating several recurring events at say the start of the semester)
- Queues now properly get cleaned at midnight
- Fixed the search and pagination of the organization users table
- Various bug fixes

***

## Version 1.1.1 - Jan 3, 2025

#### New Features
- ***General***
  - Added a changelog
    - If there are new changes, it will auto-open if you are a professor

#### Improvements
- Revamped the "You're question was deleted by a TA, would you like to rejoin?" popup modal
- Various small bug fixes

***

## Version 1.1.0 - Nov 23, 2024

#### New Features

- ***General***
  - **Queue locations**: Staff can now give each queue a location (online, hybrid, or in-person).
    - For hybrid queues, students may choose if their question is online or in-person
    - If the student's question is online, they will get a prompt to join the zoom link (that the staff member can specify at a queue-level or course-level basis) 
      - This only applies to online and hybrid queues
- ***Staff-only***
  - Staff can now "**pause**" questions, allowing staff to pause who they are currently helping
    - This contrasts "requeueing" a student, which is when a student is not ready and requires the student to "rejoin" the queue once ready
  - Staff can now **edit question tags**

#### Improvements

- The wait times and help times of questions are now more accurate, especially when the question gets helped more than once in its lifetime
  - Previously, the time displayed on the questions was the question's "lifespan," which meant it would increase even when the question was being drafted or being helped
- Questions that are in the process of "requeueing" now show up in the queue displaying as "Not Ready" rather than not showing up at all
- Misc security fixes and improvements

***

## Version 1.0.0 - Oct 2024

#### New Features

- ***General***
  - Added UI and functionality for minimum question tags
    - Staff can modify this in a queue's settings
    - Students will then be forced to give their questions the specified minimum number of tags
- ***Staff-only***
  - Added the **insights** page, allowing staff to gain some insights to the wait times, help times, what types of questions are being asked, and more
  - Added UI for **task creation/edit/deletion**, making it easier to specify assignments and tasks in queues compared to modifying the queue config JSON
  - Added a toggle to allow staff to upload documents as slides to the course chatbot. This will generate descriptions for images in said slides

#### Improvements

- Added some more loading states to various buttons
- Various security and UI fixes

***

## Version 0.9.0 - Sep 2024

- Initial release

***

## Version 0.8.0

*Change is inevitable, except from a vending machine. - Robert C. Gallagher*