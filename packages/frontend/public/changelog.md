## Version 1.1.1 - Dec 17, 2024

#### New Features
- ***General***
  - Added a changelog

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