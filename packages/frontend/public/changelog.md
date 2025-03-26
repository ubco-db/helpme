## Version 1.4.2 - Mar 9th, 2025

#### Improvements
- Fixed the Chatbot Thoughts tooltip so that it can handle larger thoughts better
- Improved the styling on the chatbot settings page
- Added tooltips to the different chatbot models for easier comparison

***

## Version 1.4.1 - Mar 4th, 2025

#### New Features

- ***Faculty-only***
  - Added new AI models
    - Deepseek R1 - A "thinking" model with much smarter answers with reasonable performance, hosted on UBC servers
      - You can see the "thoughts" of its answers by hovering the brain icon on the chatbot picture next to its answer (if its not there, then the course is not using this model)
    - Qwen - A new non-"thinking" model with somewhat smarter answers and good performance, hosted on UBC servers
      - This will be replacing the old llama3 and gemma2 models

#### Improvements

- Fixed an issue where staff would always show up as "busy"

***

## Version 1.4.0 - Mar 2nd, 2025

#### New Features

- ***General***
  - You can now leave comments on Anytime questions!
    - Note that since questions are made hidden from other students initially, only faculty can leave comments on questions until a faculty member marks the question as public
    - All students are given a different "anonymous animal" for each question to protect their privacy from other students (but faculty have the option to see who posted it)
      - A total of 70 anonymous animals with 70 different colours that get randomly picked from
    - Comes with email notifications
  - Added a new "Event Details" popup when hovering calendar events
  - Added the ability for staff to message the students that they are currently helping (or vise-versa)
- ***Faculty-only***
  - Added the ability for TAs to write notes on themselves (or professors can too)
    - These notes are displayed whenever a user hovers over the staff card on the queue page
    - Can also modify these notes on the course roster page
    - This helps the use case if one wanted to display what concepts or courses a TA can help with (e.g. this TA can only help with MATH 101)
  - Faculty can now add/remove/edit source documents on chatbot questions
  - Overhauled the Chatbot Questions page
    - Now shows interactions (so one can follow the full conversation a student has)
    - Now shows when the question was last asked (sorted descending by default to show the newest questions first)
    - Shows the number of times a question was asked (useful for suggested questions)
    - Shows the user's score on the question (when a student thumbs up/ thumbs down a question)
    - For chatbot questions with multiple interactions containing said chatbot question, those are now grouped (useful if one wanted to see what sorts of questions students are asking after selecting a suggested question)

#### Improvements

- Staff are now shown if they are helping a student in another queue or another course (would previously show the staff member as "available")
  - This should help those that are hosting help sessions in different courses at the same time
- Calendar events now show more details on them
- TAs may now subscribe/unsubscribe for email notifications for when new Anytime questions are marked as "Needs faculty help"
  - They are also now default subscribed to said notifications
- Newlines (i.e. pressing "enter") inside Anytime questions now get rendered as a newline rather than a space
- Various small improvements and fixes to the email templates for email notifications
- When navigating to another page on mobile, the navigation drawer will now automatically close
- Added a "back" button to the profile page
- Fixed an issue where your chatbot conversation would reset upon changing pages
- Fixed an issue where students could not edit their Anytime questions after they click "Satisfied" or "Needs faculty help" options
- Fixed an issue where professors that lack the corresponding "organization professor" role would not be able to access the course settings
- Fixed an issue where your Anytime question would start as non-expanded after receiving a new answer (resulting in a scenario where you would need to always click to expand your new question after creating it to see the answer)
- Fixed an issue in some cases where users did not start as subscribed to email notifications by default
  - ***NOTE***: **If you have unsubscribed from any email notifications, you will need to re-unsubscribe**
- Tweaked what is considered an "update" for the Anytime Question Hub (for showing how many updates there are on the Course Home Page)
- Added/changed various tooltips and reworked some UI around the chatbot pages to hopefully be more user-friendly
- Fixed an issue you would not be notified if there was an error during chatbot course document upload
- Fixed an issue where certain documents with null bytes were unable to be processed during chatbot course document upload
- Cleaned up the Mobile UI on the course roster page 
- Various performance and security improvements

***

## Version 1.3.0 - Feb 05, 2025

#### New Features

- ***General***
  - Added a new "System" Chatbot toggle, allowing you to ask any questions or feedback regarding the HelpMe system 
  	- By default, it will still be in "Course" mode, which will query uploaded course documents as before
  	- HelpMe developers will frequently be looking at these System Chatbot questions to improve the system and Chatbot
    	- So if you notice that the answer was not accurate, try asking it again in a couple days, it may be better!
- ***Faculty-only***
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
- ***Faculty-only***
  - Added sorting on the Assignment Report modal
    - can now sort by date, student ID, and name
  - Faculty now have the option to add students to the queue with a demo (only works with queues with an assignment ID)

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
    - This is useful if the chatbot gave an unsatisfactory answer, as a faculty member can then review the Anytime question

#### Improvements

- Faculty can now create Anytime questions 
  - While this isn't really intended, this was enabled so that faculty can better learn the system or if they want to demo the system to students
- Fixed a bug where all Anytime questions would be marked as "Human Verified" even if the faculty member did not modify the answer nor clicked the box to mark it as faculty verified
- Fixed a bug where the "Check In" button on the home course page did not work

***

## Version 1.2.0 - Jan 11, 2025

#### New Features

- ***General***
  - When the last TA checks out of a queue, students with questions will now be prompted whether they would like to leave the queue or stay
    - If they don't respond in 10 minutes, the question will automatically be closed
- ***Faculty-only***
  - Faculty can now be assigned to events (on the schedule page)! When you do so, said faculty will be prompted to check-out of the queue when the event ends (they can select if they need 10 more minutes). 
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
  - **Queue locations**: Faculty can now give each queue a location (online, hybrid, or in-person).
    - For hybrid queues, students may choose if their question is online or in-person
    - If the student's question is online, they will get a prompt to join the zoom link (that the faculty member can specify at a queue-level or course-level basis) 
      - This only applies to online and hybrid queues
- ***Faculty-only***
  - Faculty can now "**pause**" questions, allowing faculty to pause who they are currently helping
    - This contrasts "requeueing" a student, which is when a student is not ready and requires the student to "rejoin" the queue once ready
  - Faculty can now **edit question tags**

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
    - Faculty can modify this in a queue's settings
    - Students will then be forced to give their questions the specified minimum number of tags
- ***Faculty-only***
  - Added the **insights** page, allowing faculty to gain some insights to the wait times, help times, what types of questions are being asked, and more
  - Added UI for **task creation/edit/deletion**, making it easier to specify assignments and tasks in queues compared to modifying the queue config JSON
  - Added a toggle to allow faculty to upload documents as slides to the course chatbot. This will generate descriptions for images in said slides

#### Improvements

- Added some more loading states to various buttons
- Various security and UI fixes

***

## Version 0.9.0 - Sep 2024

- Initial release

***

## Version 0.8.0

*Change is inevitable, except from a vending machine. - Robert C. Gallagher*