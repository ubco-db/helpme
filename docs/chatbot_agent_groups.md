# Chatbot Agent Groups

Chatbot agent groups let one visible course route chatbot questions to several
hidden agent courses. This is intended as a small MVP for projects like
LANTERN, where each agent needs its own prompt, documents, settings, and chat
history, but students should only enter the main course.

## Setup

Run the seed command:

```bash
yarn seed:chatbot-agent-group
```

The command expects the `UBC` organization and `2026S Both Terms` semester to
already exist. It creates or reuses the visible `LANTERN` parent course, the
four agent courses, and the `chatbot_agent_group` super course within that
organization and semester. It connects those courses and enables chatbot
settings.

Students still need to be enrolled in the visible parent course separately.
When they select an agent, HelpMe allows the chatbot request to use that agent
course if it belongs to the same `chatbot_agent_group` as the parent course.
