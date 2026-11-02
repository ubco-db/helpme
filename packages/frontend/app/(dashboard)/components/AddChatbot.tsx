'use client';
import type React from 'react';
import { useEffect } from 'react';
import { useChatbotContext } from '../course/[cid]/components/chatbot/ChatbotProvider';
import { usePathname } from 'next/navigation';

type AddChatbotProps = {
  courseId: number;
  children?: React.ReactNode;
};

/** Adds the sticky chatbot button/modal to side of the page
 * Only added in a couple areas right now, will move to other areas and do refactoring in the future.
 * This is kinda a workaround to get this on layout.tsx (which is a server component)
 */
const AddChatbot: React.FC<AddChatbotProps> = ({ courseId, children }) => {
  const pathname = usePathname();
  const { setCid, setRenderSmallChatbot } = useChatbotContext();
  useEffect(() => {
    setCid(courseId);
  }, [courseId, setCid]);
  useEffect(() => {
    setRenderSmallChatbot(!pathname.endsWith('/canvas_batch_grading'));
    return () => setRenderSmallChatbot(false); // make the chatbot inactive when the user leaves the page
  }, [pathname, setRenderSmallChatbot]);
  return children;
};
export default AddChatbot;
