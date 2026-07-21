# Chatbot Agent Groups

Chatbot agent groups let one visible course route chatbot questions to several
separate agent courses. This is intended as a small MVP for projects like
LANTERN, where each agent needs its own prompt, documents, settings, and chat
history, while students only enter the main course.

## Setup

Run the seed command:

```bash
yarn seed:chatbot-agent-group
```

The command expects the `UBC` organization and `2026S Both Terms` semester to
already exist. It creates or reuses the visible `LANTERN` parent course, the
four agent courses, and the `chatbot_agent_group` super course within that
organization and semester. It connects those courses to the group. Missing
`course_settings` rows are created with the chatbot enabled; existing course
settings are preserved as-is, so a chatbot that has been deliberately disabled
is not re-enabled. Professors enrolled in the `LANTERN` parent course are also
enrolled in each agent course with the ordinary `professor` course role. This
lets them use the existing course list and chatbot settings, knowledge base, and
question pages for each agent.

Students still need to be enrolled in the visible parent course separately and
are not enrolled in agent courses. When they select an agent, HelpMe allows the
chatbot request to use that agent course if it belongs to the same
`chatbot_agent_group` as the parent course.

The seed is transactional and idempotent. Missing agent-course memberships are
created with the `professor` role; any existing agent-course membership keeps
its current role and favourited state. A transaction-scoped PostgreSQL advisory
lock serializes concurrent invocations so no duplicate courses or memberships
are produced. The seed does not manage the agent lifecycle after setup.
