import React from 'react'

export const ChatbotDetails: React.FC = () => {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 bg-white p-4 dark:bg-gray-900 md:grid-cols-2">
        <div className="flex items-center justify-center">
          <video controls autoPlay loop muted className="w-full ">
            <source src="/random.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="flex flex-col justify-center p-4">
          <h1 className="mb-4 text-4xl font-bold text-gray-800 dark:text-white md:text-5xl">
            Where do students access AI
          </h1>
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            <strong>Chatbot Interface:</strong> Your gateway to instant
            communication, accessible directly on the homepage or as a popup.
          </p>
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            <strong>Asynchronous Question Center:</strong> Submit your questions
            anytime. Get automated answers or opt for human assistance if
            needed.
          </p>
          {/* <a href="/" className="text-lg text-blue-600 hover:text-blue-800 visited:text-purple-600 underline">
          
        </a> */}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <div className="flex flex-col justify-center p-4">
          <h1 className="mb-4 text-4xl font-bold text-gray-800 dark:text-white md:text-5xl">
            Customize course specific AI
          </h1>
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            <strong>Customization: </strong>Large language model generation
            enhanced with retrieval of documents you provide
          </p>
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            <strong>Accuracy and domain specific: </strong>Improve accuracy and
            domain specific knowledge
          </p>
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
            <strong>Trust in AI: </strong>Incorporate human verification to
            recycle and improve responses
          </p>
          <a
            href="#integration-details"
            className="text-lg text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          ></a>
        </div>
        <div className="flex items-center justify-center">
          <img
            src="./integration-image.gif"
            alt="Integration Diagram"
            className="h-auto max-w-full"
          />
        </div>
      </div>
    </div>
  )
}

export default ChatbotDetails
