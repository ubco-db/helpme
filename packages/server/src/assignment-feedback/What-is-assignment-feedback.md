This "AI Assignment Feedback" feature allows students to get annotated feedback on their assignments/essays.

**IMPORTANT:** Right now, only used in LLED courses and is hardcoded as such. To make it general-purpose, the citations need to no longer be hardcoded and there actually needs to be some sorta interface for allowing professors to create a criteria prompt with various "categories" that students can filter the feedback from (for LLED's usecase, it's "Function" and "Level"). This prompt could also be LLM-generated based on files the professor uploads, as another idea.

Flow:
1. Student first uploads assignment pdf/word file
2. `:courseId/extract-text` extracts the text from said file and places it inside a textbox on the frontend
3. Student hits "generate feedback" button, which is sent to `:courseId/generate-feedback` and does the following:
   1. First calls the LLM to reformat the whole text into well-formatted and labeled paragraphs. (This is because text extractors can mess up the formatting of the paragraphs, which would lead to inconsistent labelling and a somewhat ugly UI since we also display these well-formatted paragraphs rather than the text-extractor output)
   2. Calls the LLM with the labeled paragraphs to generate some annotations. It uses the `feedback-prompt.md` which includes instructions for what types of feedback to be given, the response format, etc. It also includes *direct quotes* for each feedback item.
   3. Because LLMs process things in tokens, it can't give an accurate "start character index" and "end character index" for the annotations (it's usually wildly off). Thus, we use the direct quote given to us and we determine programmatically where to put the start and end indices.
   4. LLM response is validated. And if good, send the json response to the frontend to be displayed.

Suggested Materials/Citations are hard-coded for now based on the `level` + `function` combinations (these categories are LLED-specific, and are mostly just used for filters on the frontend so that students can filter feedback types). Later, feeding each feedback annotation into the RAG system to collect a series of suggested materials.
