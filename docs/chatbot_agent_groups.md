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

The command creates or reuses the visible `LANTERN` parent course, the four
agent courses, and the `chatbot_agent_group` super course. It connects those
courses, enables chatbot settings, and enrolls `studentOne@ubc.ca` in the
visible parent course when that seed user exists.

Students only need enrollment in the visible parent course. When they select an
agent, HelpMe allows the chatbot request to use that agent course if it belongs
to the same `chatbot_agent_group` as the parent course.
