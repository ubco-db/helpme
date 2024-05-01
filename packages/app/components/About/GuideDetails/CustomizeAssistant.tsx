import React from 'react'

export const CustomizeAssistant: React.FC = () => {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">
        How to Customize the Assistant
      </h2>
      <div className="mb-4">
        <h3 className="font-semibold">
          Step 1: Access the Admin Panel and Chatbot Settings
        </h3>
        <p>
          Navigate to the admin panel where you can access chatbot settings to
          start creating your customized bot.
        </p>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Step 2: Select and Upload Documents</h3>
        <p>
          Choose documents that contain the knowledge base you want your
          assistant to learn. Important tips for document selection include:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Textual Information:</strong> Ensure that documents are
            text-rich as the chatbot processes textual data.
          </li>
          <li>
            <strong>Consistency:</strong> Avoid using documents with conflicting
            information to prevent confusion and errors in the bot&apos;s
            responses.
          </li>
        </ul>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Step 3: Configure Parameters</h3>
        <p>
          Adjust the default settings to tailor the chatbot&apos;ss behavior to
          your needs:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Model Selection:</strong> Choose a base language model that
            best suits your requirements. Tooltips can guide you through each
            option.
          </li>
          <li>
            <strong>Default Prompt:</strong> Set up an initial prompt that the
            chatbot will use to start conversations.
          </li>
          <li>
            <strong>Similarity Thresholds:</strong> Determine the thresholds for
            questions and document retrieval to manage how the bot recognizes
            and handles similar queries and content.
          </li>
          <li>
            <strong>Temperature:</strong> Adjust this setting to control the
            variability in response generation. Lower values result in more
            predictable responses.
          </li>
          <li>
            <strong>Top K:</strong> Define the maximum number of information
            blocks the chatbot retrieves per question, influencing the depth and
            breadth of responses.
          </li>
        </ul>
      </div>
      <div className="mb-4">
        <h3 className="font-semibold">Step 4: Monitor and Verify the System</h3>
        <p>
          After launching your chatbot, it&apos;ss crucial to monitor and verify
          its performance to ensure its effectiveness:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Admin Panel Monitoring:</strong> Use the admin panel&apos;ss
            chatbot question monitor to track interactions. This feature helps
            administrators see what questions are being asked and how the
            chatbot responds in real-time.
          </li>
          <li>
            <strong>Edit and Improve Q&As:</strong> Regularly review and refine
            the Q&A database. This is essential for enhancing chatbot
            performance, verifying answers, and building trust with users.
          </li>
          <li>
            <strong>Visualization Tools:</strong> Consider integrating visual
            tools or dashboards that allow administrators to easily manage,
            edit, and verify Q&As. These tools can help visualize the flow of
            questions and answers, making it easier to identify patterns or
            common issues that may require attention.
          </li>
        </ul>
      </div>
    </div>
  )
}

export default CustomizeAssistant
