/**
 * Styles for markdown document conversion to PDF
 * These styles are applied to the HTML template before PDF conversion.
 * Retrieved from https://github.com/markdowncss/modest/blob/master/css/modest.css
 */
export const markdownStyles = `
@media print {
  *,
  *:before,
  *:after {
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  a,
  a:visited {
    text-decoration: underline;
  }

  a[href]:after {
    content: " (" attr(href) ")";
  }

  abbr[title]:after {
    content: " (" attr(title) ")";
  }

  a[href^="#"]:after,
  a[href^="javascript:"]:after {
    content: "";
  }

  pre,
  blockquote {
    border: 1px solid #999;
    page-break-inside: avoid;
  }

  thead {
    display: table-header-group;
  }

  tr,
  img {
    page-break-inside: avoid;
  }

  img {
    max-width: 100% !important;
  }

  p,
  h2,
  h3 {
    orphans: 3;
    widows: 3;
  }

  h2,
  h3 {
    page-break-after: avoid;
  }
}


html {
  font-size: 85%;
}


pre,
code {
  font-family: Menlo, Monaco, "Courier New", monospace;
}

pre {
  padding: .5rem;
  line-height: 1.25;
  overflow-x: scroll;
}

a,
a:visited {
  color: #3498db;
}

a:hover,
a:focus,
a:active {
  color: #2980b9;
}

.modest-no-decoration {
  text-decoration: none;
}

body {
  line-height: 1.85;
}

p,
.modest-p {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

h1,
.modest-h1,
h2,
.modest-h2,
h3,
.modest-h3,
h4,
.modest-h4 {
  margin: 1rem 0 0.5rem;
  font-weight: inherit;
  line-height: 1.3;
}

h1,
.modest-h1 {
  margin-top: 0;
  font-size: 2.2rem;
}

h2,
.modest-h2 {
  font-size: 1.8rem;
}

h3,
.modest-h3 {
  font-size: 1.5rem;
}

h4,
.modest-h4 {
  font-size: 1.2rem;
}

h5,
.modest-h5 {
  font-size: 1rem;
}

h6,
.modest-h6 {
  font-size: .85rem;
}

small,
.modest-small {
  font-size: .707em;
}

/* https://github.com/mrmrs/fluidity */

img,
canvas,
iframe,
video,
svg,
select,
textarea {
  max-width: 100%;
}

@import url(http://fonts.googleapis.com/css?family=Open+Sans+Condensed:300,300italic,700);

@import url(http://fonts.googleapis.com/css?family=Arimo:700,700italic);

html {
  max-width: 100%;
}

body {
  color: #444;
  font-family: 'Open Sans Condensed', sans-serif;
  font-weight: 300;
  margin: 0 auto;
  line-height: normal;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: Arimo, Helvetica, sans-serif;
}

h1,
h2,
h3 {
  border-bottom: 2px solid #fafafa;
  margin-bottom: 0.5rem;
  padding-bottom: 0.1rem;
  text-align: center;
}

blockquote {
  border-left: 8px solid #fafafa;
  padding: 0.5rem;
}

pre,
code {
  background-color: #fafafa;
}
`;

/**
 * Function to generate a full HTML template with the markdown styles for the pdf conversion
 */
export function generateHTMLForMarkdownToPDF(params: {
  title: string;
  author: string;
  courseName: string;
}): string {
  const { title, author, courseName } = params;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="author" content="${author}">
    <meta name="description" content="Course material for ${courseName || 'course'}">
    <title>${title}</title>
    <style>
      ${markdownStyles}
    </style>
  </head>
  <body>
    {{ toHTML "file.md" }}
  </body>
</html>`;
}
