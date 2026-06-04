# PRIVACY POLICY

**Last Updated: May 11, 2026**

This Privacy Policy describes how the **HelpMe (UBC Project)** research team ("we," "us," or "our") collects, uses, stores, and protects your personal information when you use our services at [http://www.coursehelp.ubc.ca](http://www.coursehelp.ubc.ca) (the "Services"). 

HelpMe is a student-led research project at the University of British Columbia (UBC). We are not a commercial entity. We are committed to data minimization, meaning we collect only the bare minimum information required for the application to function. All primary data is kept strictly within UBC servers, and we do not sell or share your data with external providers or businesses.

This information is collected under the authority of section 26(c) of the British Columbia *Freedom of Information and Protection of Privacy Act* (FIPPA).

---

## 1. WHAT INFORMATION WE COLLECT AND WHY

We collect information to provide, manage, and improve the HelpMe platform. 

To ensure transparency, we distinguish between data you provide to us **directly** and data we collect **indirectly** via external integrations or user interactions you may not expect to be collected. 

We also provide a short explanation of what we use the data for. If you would like to know more, you may contact us (contact at bottom of this document).

While we do collect other data not mentioned here (such as course configurations or whether you have read the changelog), none of it is personally-identifiable and is thus excluded for brevity. 

### A. Account & Profile Information
* **Names and Email Addresses (Direct & Indirect):** Collected to create your account, identify you within the system, and send necessary notifications. If you choose to log in using a third-party provider (e.g., Google or UBC CWL), we collect this information from them.
* **Passwords (Direct):** Required if you choose to create a HelpMe account via none-single sign-on (SSO) methods. We store a salted, hashed (one-way encrypted) version of the password using the [bcrypt](https://en.wikipedia.org/wiki/Bcrypt) hashing algorithm.
* **Student ID (Direct, Optional):** Provided at your discretion to help Course Staff easily identify you for grading or course administration.
* **Name Pronunciation (Direct, Optional):** Displayed to Course Staff on your Queue Questions and the Course Roster page.
* **Profile Photo (Direct & Indirect, Optional):** Uploaded by you (or retrieved indirectly via Google Login) to personalize your profile. This is visible to other users in the system, mainly Course Staff, HelpMe Administrators, and any Anytime Questions you choose to be unanonymized for.
* **Browser Notification Settings (Direct):** If you opt-in to receive browser notification alerts, we store the device subscription token provided by your web browser to route notifications to your specific device. We strictly store this registration data and do not store the notifications themselves. Subscription tokens are automatically invalidated and deleted if they expire, if you revoke browser permissions, or upon account deletion.

### B. Interaction & System Data
* **Organization (Direct & Indirect):** When you create an account or login into HelpMe, we store what organization you are part of. We decide what organization based on what you directly selected on the Login page or indirectly by what course you get invited to.
* **Enrolled HelpMe Courses (Direct):** We track which courses you have joined via professor-given invite links and your role in said course to grant you access to the course's available tools (Queues, Anytime Questions, Chatbot).
* **Course Chatbot Questions & Conversations (Indirect):** The questions you send to the AI chatbot and the full conversational history are stored. This allows you to view your own history and allows professors to monitor general course queries.
* **Queue Questions (Direct):** Includes the question text, any given question types, creation timestamps, and whether the question is In-Person or Online.
* **Queue Question History (Indirect):** Previously asked queue questions in the course are stored to allow Course Staff to view and gather insights, such as see commonly-asked questions or when their queues are busy.
* **Queue Chat Messages (Direct):** Messages sent within an active queue session. These are cached temporarily until the question is resolved. For permanent analytics, we only retain the total number of messages of the conversation, not the chat text itself.
* **Queue Task-Questions (Direct):** If the professor creates a queue with defined "tasks", students may directly create "Demo" Queue Questions which ask how many tasks are to be checked. The cumulative list of all tasks completed is stored to allow Course Staff to use this information for their grading
* **Anytime Questions & Comments (Direct):** Questions posted to the Anytime Question Hub and any subsequent comments. 
* **Anytime Question Upvotes/Downvotes (Direct):** Tracked strictly to prevent users from upvoting or downvoting the same question multiple times.
* **Diagnostics & Errors (Indirect):** Any errors that occur are collected and sent to Sentry servers. Information transmitted is limited to technical and telemetry data. 

### C. Course Staff & Administration Data (Staff Only)
* **Check-in/Check-out Times (Indirect):** Used by professors to monitor when Course Staff are actively managing a queue.
* **Course Staff Schedule (Direct, Optional):** Uploaded by professors to display staff availability to students and to enable automatic check-outs from queues.
* **Questions Helped & Answers Provided (Indirect):** Tracked to populate an Insights page for professors, allowing them to gauge busy times and total questions resolved by individual staff members.
* **Canvas LMS Integration Data (Indirect):** When Course Staff integrate their course with Canvas, we use the Canvas API in a read-only way to obtain necessary course data. We temporarily cache Canvas API responses for up to 30 minutes to optimize performance. We only permanently store Canvas items (such as assignments, quizzes, announcements, files, and pages) that Course Staff explicitly choose to synchronize with HelpMe.

---

## 2. HOW WE STORE AND PROTECT YOUR DATA

Primary application data and databases are confined to secure UBCO infrastructure. 

* **Application & Database:** The HelpMe web application and PostgreSQL database are hosted on an EduCloud Virtual Machine (VM). Access is secured via UBC Campus-Wide Login (CWL). Backups are encrypted and stored within EduCloud infrastructure (ISS U5 Tier 3).
* **AI Infrastructure:** Our Large Language Model (LLM) runs on a physical GPU server located in a secure UBC data centre at the UBC Okanagan campus. It is managed and monitored by UBCO IT, with access strictly controlled via CWL.

**We make NO external API calls to third-party AI services.** Your data never leaves the UBC network to be processed by outside generative AI providers.

**Data Breach Notification**
In the event of a security breach or unauthorized access that could reasonably be expected to result in significant harm, we will promptly notify affected users, the relevant UBC authorities, and the Office of the Information and Privacy Commissioner (OIPC) in accordance with our obligations under the British Columbia Freedom of Information and Protection of Privacy Act (FIPPA).

---

## 3. ARTIFICIAL INTELLIGENCE (AI) POLICY

Our Course Chatbot utilizes a Retrieval-Augmented Generation (RAG) mechanism powered by a local LLM to answer questions based on course materials. 

* **No Data Training:** We do **not** use your personal information, questions, or chat history to train or fine-tune our AI models. The LLM is strictly used for processing and generating real-time responses to course queries and for Chatbot document upload.
* **Local Document Processing:** All professor-uploaded chatbot documents (including LMS documents) are processed locally on HelpMe servers. Documents are chunked into blocks of text, and images are locally analyzed to generate text descriptions.
* **Document Storage & Citations:** We store the full text of manually uploaded documents so that students can click chatbot citations to view the source document. For documents synchronized directly from an LMS (like Canvas), we do not store the full document; instead, the chatbot citations link directly back to the secure LMS environment.
* **Privacy:** Because the LLM is hosted on UBC Okanagan servers, your queries are processed locally and are never transmitted to external companies (such as OpenAI or Google).

---

## 4. VISIBILITY, ANONYMITY, AND DATA SHARING

We default to privacy and require your explicit consent before sharing personally identifiable information (PII) with other students. However, course staff have different visibility rights.

* **Queue Questions:** The text, question types, and location of your question may be visible to all students in the course, but your identity is **always anonymized** to other students. Course staff can see all details of queue questions, including previously-asked queue questions. 
* **Anytime Questions & Comments:** If the question was made visible to other students in the course (by Course Staff or the creator), your identity is **anonymized by default** (though you may manually choose to reveal your identity).
* **Course Staff Visibility:** Course Staff and Professors can always see who asked Queue Questions, Anytime Questions, and Anytime Question Comments. 
* **Chatbot Visibility:** Professors can see what Chatbot questions are being asked for their course's Chatbot, but they **cannot** see who asked them. HelpMe administrators will only deanonymize chatbot logs at the request of course staff in cases involving suspected academic misconduct, threats of harm, formal legal/university investigations, or if the student provides explicit consent (such as via a research consent form).

**Third-Party Sharing**
We do not sell or share your data with external third parties, with the following exceptions:
* **Academic Dishonesty & Legal Obligations:** We may share your data with your professors, UBC administration, or law enforcement if required for academic misconduct investigations or legal compliance.
* **Google Login:** If you choose to log in using Google, we receive your name, email, and profile picture. Please note that Google may independently collect data regarding your login activity according to their own privacy policies.
* **Sentry (Error Tracking):** We use Sentry to monitor application crashes and errors to maintain system stability. Sentry's servers are located in the United States. To protect your privacy, we employ strict code-review protocols to designed to prevent the transmission of Personally Identifiable Information (PII) to Sentry. Sentry is also configured to not collect IP addresses, page text, and request bodies to drastically reduce the probability of any PII leaving UBC infrastructure. The information transmitted to Sentry is restricted to technical diagnostic and telemetry data.

**Research**
Although HelpMe is a research project, **we do not perform any data processing for research purposes without your explicit consent.** If a professor chooses to include their HelpMe course in a research study, individual student consent must be collected via a separate, explicit form before any data is utilized for research.

---

## 5. COOKIES AND TRACKING TECHNOLOGIES 

We use cookies exclusively for essential site functionality, such as maintaining your active login session. We do **not** use cookies for tracking, analytics, or advertising purposes. 

---

## 6. DATA RETENTION AND DELETION

**Data Storage and Backups** 
All system backups are encrypted and securely stored within EduCloud infrastructure (ISS U5 Tier 3) under the management of UBCO's IT team. Backups are retained for up to 90 days before they are permanently destroyed.

**Data Deletion Requests**
You may submit a request to have your personal data removed from the active platform. These requests are processed under the following guidelines:

- **General Platform Data:** Removed from our active production databases within 7 days. This data will remain securely encrypted in system backups until those backups naturally expire after 90 days. If a system restoration is ever required, your deletion request will be reapplied.
- **Grading and Academic Records:** Under Section 31 of BC’s _Freedom of Information and Protection of Privacy Act_ (FIPPA), any personal information used to evaluate student work and assign a grade must be retained for at least one year. Therefore, deletion requests for grading-related data will only be fulfilled after this legally mandated one-year retention period has expired.

---

## 7. YOUR PRIVACY RIGHTS

Under BC FIPPA, you have the right to request access to the personal information we hold about you, request corrections to inaccuracies, or request the deletion of your account and associated active data.

If you have questions, concerns, or wish to exercise your data rights, please contact the project supervisor:

**Dr. Ramon Lawrence**
HelpMe (UBC Project)
3333 University Way
Kelowna, British Columbia V1V 1V7
Canada
Email: [ramon.lawrence@ubc.ca](mailto:ramon.lawrence@ubc.ca)
