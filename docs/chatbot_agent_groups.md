# Chatbot Agent Groups

Chatbot agent groups let one visible course route chatbot questions to several
hidden agent courses. This is intended as a small MVP for projects like
LANTERN, where each agent needs its own prompt, documents, settings, and chat
history, but students should only enter the main course.

## Manual Setup

1. Create the visible parent course normally.
2. Create one course per chatbot agent.
3. Put the parent and agent courses in the same `super_course_model` row.
4. Set the super course `purpose` to `chatbot_agent_group`.
5. Set `chatbotAgentName`, `chatbotAgentDescription`, and
   `chatbotAgentOrder` on each agent course.
6. Leave `chatbotAgentName` empty on the visible parent course.

Example:

```sql
INSERT INTO super_course_model ("name", "organizationId", "purpose")
VALUES ('LANTERN Agents', :organization_id, 'chatbot_agent_group')
RETURNING id;

UPDATE course_model
SET "superCourseId" = :super_course_id
WHERE id IN (
  :parent_course_id,
  :analyst_course_id,
  :communicator_course_id,
  :strategist_course_id,
  :thrive_course_id
);

UPDATE course_model
SET
  "chatbotAgentName" = 'Analyst',
  "chatbotAgentDescription" = 'Research foundations, statistics, research methods, terminology, philosophy of science, and critical appraisal.',
  "chatbotAgentOrder" = 1
WHERE id = :analyst_course_id;

UPDATE course_model
SET
  "chatbotAgentName" = 'Communicator',
  "chatbotAgentDescription" = 'Scholarly communication, literature synthesis, scientific writing, and oral presentations.',
  "chatbotAgentOrder" = 2
WHERE id = :communicator_course_id;

UPDATE course_model
SET
  "chatbotAgentName" = 'Strategist',
  "chatbotAgentDescription" = 'Grantsmanship, funder alignment, grant structure, budget justification, project management, and reviewer perspective.',
  "chatbotAgentOrder" = 3
WHERE id = :strategist_course_id;

UPDATE course_model
SET
  "chatbotAgentName" = 'Thrive',
  "chatbotAgentDescription" = 'Academic culture, hidden curriculum, mentorship navigation, common challenges in academia, and career planning.',
  "chatbotAgentOrder" = 4
WHERE id = :thrive_course_id;
```

Students only need enrollment in the visible parent course. When they select an
agent, HelpMe allows the chatbot request to use that agent course if it belongs
to the same `chatbot_agent_group` as the parent course.
