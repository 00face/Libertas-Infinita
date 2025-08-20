/**
 * Node Showcases - Comprehensive Demonstration System
 * 
 * This file contains all showcase implementations that demonstrate
 * the capabilities of various node types. Each showcase is designed
 * to match the exact visual appearance and functionality of manually
 * added nodes.
 */

class NodeShowcases {
    constructor(ide) {
        this.ide = ide;
    }

    /**
     * Load a showcase by clearing the canvas and deserializing the showcase data
     */
    loadShowcase(jsonString) {
        this.ide.clearCanvas();
        this.ide.deserialize(jsonString);
        this.ide.recordState("Load Showcase");
    }

    /**
     * DATA PROCESSING SHOWCASES
     */

    /**
     * CSV Processing Pipeline
     * Demonstrates: Import → CSV Parser → Filter → Transform → Export
     */
    addShowcaseCSVProcessing() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "import",
                    "x": 50,
                    "y": 50,
                    "width": "280px",
                    "height": "200px",
                    "content": {
                        "data_out": "name,age,department,salary\nAlice,28,Engineering,75000\nBob,32,Marketing,68000\nCharlie,25,Engineering,72000\nDiana,35,Marketing,71000\nEve,29,HR,65000"
                    }
                },
                {
                    "id": "node_1",
                    "type": "csv",
                    "x": 380,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "filter",
                    "x": 630,
                    "y": 50,
                    "width": "280px",
                    "height": "180px",
                    "content": {
                        "condition": "row.age > 27 && row.department === 'Engineering'"
                    }
                },
                {
                    "id": "node_3",
                    "type": "transform",
                    "x": 960,
                    "y": 50,
                    "width": "300px",
                    "height": "200px",
                    "content": {
                        "logic": "// Calculate annual bonus\nreturn {\n  ...row,\n  salary: parseFloat(row.salary),\n  bonus: parseFloat(row.salary) * 0.15,\n  total_comp: parseFloat(row.salary) * 1.15\n};"
                    }
                },
                {
                    "id": "node_4",
                    "type": "export",
                    "x": 1310,
                    "y": 50,
                    "width": "300px",
                    "height": "300px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "data_out"}, "to": {"node": "node_1", "socket": "csv_in"}},
                {"from": {"node": "node_1", "socket": "data_out"}, "to": {"node": "node_2", "socket": "data_in"}},
                {"from": {"node": "node_2", "socket": "data_out"}, "to": {"node": "node_3", "socket": "data_in"}},
                {"from": {"node": "node_3", "socket": "data_out"}, "to": {"node": "node_4", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * JSON Transform Pipeline
     * Demonstrates: Import → JSON Parse → Transform → Aggregate → JSON Stringify → Export
     */
    addShowcaseJSONTransform() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "import",
                    "x": 50,
                    "y": 50,
                    "width": "320px",
                    "height": "280px",
                    "content": {
                        "data_out": "[\n  {\"user_id\": 1, \"first_name\": \"John\", \"last_name\": \"Doe\", \"email\": \"john@example.com\", \"birth_year\": 1990},\n  {\"user_id\": 2, \"first_name\": \"Jane\", \"last_name\": \"Smith\", \"email\": \"jane@example.com\", \"birth_year\": 1985},\n  {\"user_id\": 3, \"first_name\": \"Bob\", \"last_name\": \"Johnson\", \"email\": \"bob@example.com\", \"birth_year\": 1992}\n]"
                    }
                },
                {
                    "id": "node_1",
                    "type": "json",
                    "x": 420,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {
                        "operation": "parse"
                    }
                },
                {
                    "id": "node_2",
                    "type": "transform",
                    "x": 670,
                    "y": 50,
                    "width": "320px",
                    "height": "220px",
                    "content": {
                        "logic": "// Transform user data\nconst currentYear = new Date().getFullYear();\nreturn {\n  id: row.user_id,\n  full_name: `${row.first_name} ${row.last_name}`,\n  email: row.email,\n  age: currentYear - row.birth_year,\n  domain: row.email.split('@')[1]\n};"
                    }
                },
                {
                    "id": "node_3",
                    "type": "aggregate",
                    "x": 1040,
                    "y": 50,
                    "width": "250px",
                    "height": "180px",
                    "content": {
                        "groupBy": "domain",
                        "aggFunc": "count",
                        "aggKey": "id"
                    }
                },
                {
                    "id": "node_4",
                    "type": "json",
                    "x": 1340,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {
                        "operation": "stringify"
                    }
                },
                {
                    "id": "node_5",
                    "type": "export",
                    "x": 1590,
                    "y": 50,
                    "width": "280px",
                    "height": "250px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "data_out"}, "to": {"node": "node_1", "socket": "data_in"}},
                {"from": {"node": "node_1", "socket": "data_out"}, "to": {"node": "node_2", "socket": "data_in"}},
                {"from": {"node": "node_2", "socket": "data_out"}, "to": {"node": "node_3", "socket": "data_in"}},
                {"from": {"node": "node_3", "socket": "data_out"}, "to": {"node": "node_4", "socket": "data_in"}},
                {"from": {"node": "node_4", "socket": "data_out"}, "to": {"node": "node_5", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * Data Analysis Pipeline
     * Demonstrates: Import → CSV Parse → Transform → Multiple Aggregations → Export
     */
    addShowcaseDataAnalysis() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "import",
                    "x": 50,
                    "y": 50,
                    "width": "300px",
                    "height": "220px",
                    "content": {
                        "data_out": "product,category,price,quantity,region\nLaptop,Electronics,999.99,5,North\nMouse,Electronics,29.99,20,North\nKeyboard,Electronics,79.99,15,North\nChair,Furniture,299.99,8,South\nDesk,Furniture,499.99,3,South\nLaptop,Electronics,999.99,7,South\nMouse,Electronics,29.99,25,West"
                    }
                },
                {
                    "id": "node_1",
                    "type": "csv",
                    "x": 380,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "transform",
                    "x": 630,
                    "y": 50,
                    "width": "280px",
                    "height": "200px",
                    "content": {
                        "logic": "// Calculate revenue per item\nreturn {\n  ...row,\n  price: parseFloat(row.price),\n  quantity: parseInt(row.quantity),\n  revenue: parseFloat(row.price) * parseInt(row.quantity)\n};"
                    }
                },
                {
                    "id": "node_3",
                    "type": "aggregate",
                    "x": 960,
                    "y": 50,
                    "width": "250px",
                    "height": "180px",
                    "content": {
                        "groupBy": "category",
                        "aggFunc": "sum",
                        "aggKey": "revenue"
                    }
                },
                {
                    "id": "node_4",
                    "type": "aggregate",
                    "x": 960,
                    "y": 280,
                    "width": "250px",
                    "height": "180px",
                    "content": {
                        "groupBy": "region",
                        "aggFunc": "sum",
                        "aggKey": "revenue"
                    }
                },
                {
                    "id": "node_5",
                    "type": "export",
                    "x": 1260,
                    "y": 50,
                    "width": "280px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_6",
                    "type": "export",
                    "x": 1260,
                    "y": 280,
                    "width": "280px",
                    "height": "200px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "data_out"}, "to": {"node": "node_1", "socket": "csv_in"}},
                {"from": {"node": "node_1", "socket": "data_out"}, "to": {"node": "node_2", "socket": "data_in"}},
                {"from": {"node": "node_2", "socket": "data_out"}, "to": {"node": "node_3", "socket": "data_in"}},
                {"from": {"node": "node_2", "socket": "data_out"}, "to": {"node": "node_4", "socket": "data_in"}},
                {"from": {"node": "node_3", "socket": "data_out"}, "to": {"node": "node_5", "socket": "data_in"}},
                {"from": {"node": "node_4", "socket": "data_out"}, "to": {"node": "node_6", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * Complex Data Pipeline
     * Demonstrates: Multiple Imports → CSV Parse → Merge → Filter → Transform → Export
     */
    addShowcaseComplexPipeline() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "import",
                    "x": 50,
                    "y": 50,
                    "width": "280px",
                    "height": "200px",
                    "content": {
                        "data_out": "emp_id,name,department,salary\n101,Alice Johnson,Engineering,75000\n102,Bob Smith,Marketing,68000\n103,Carol Davis,Engineering,72000\n104,David Wilson,HR,65000"
                    }
                },
                {
                    "id": "node_1",
                    "type": "import",
                    "x": 50,
                    "y": 300,
                    "width": "280px",
                    "height": "180px",
                    "content": {
                        "data_out": "dept_id,dept_name,manager,budget\nEngineering,Engineering,Sarah Chen,500000\nMarketing,Marketing,Mike Rodriguez,300000\nHR,Human Resources,Lisa Brown,200000"
                    }
                },
                {
                    "id": "node_2",
                    "type": "csv",
                    "x": 380,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_3",
                    "type": "csv",
                    "x": 380,
                    "y": 300,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_4",
                    "type": "merge",
                    "x": 630,
                    "y": 175,
                    "width": "280px",
                    "height": "180px",
                    "content": {
                        "key": "department=dept_name"
                    }
                },
                {
                    "id": "node_5",
                    "type": "filter",
                    "x": 960,
                    "y": 175,
                    "width": "280px",
                    "height": "180px",
                    "content": {
                        "condition": "parseFloat(row.salary) > 70000"
                    }
                },
                {
                    "id": "node_6",
                    "type": "transform",
                    "x": 1290,
                    "y": 175,
                    "width": "320px",
                    "height": "220px",
                    "content": {
                        "logic": "// Calculate salary vs budget ratio\nconst budgetRatio = (parseFloat(row.salary) / parseFloat(row.budget) * 100).toFixed(2);\nreturn {\n  employee: row.name,\n  department: row.department,\n  manager: row.manager,\n  salary: parseFloat(row.salary),\n  budget_percentage: `${budgetRatio}%`\n};"
                    }
                },
                {
                    "id": "node_7",
                    "type": "export",
                    "x": 1660,
                    "y": 175,
                    "width": "300px",
                    "height": "250px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "data_out"}, "to": {"node": "node_2", "socket": "csv_in"}},
                {"from": {"node": "node_1", "socket": "data_out"}, "to": {"node": "node_3", "socket": "csv_in"}},
                {"from": {"node": "node_2", "socket": "data_out"}, "to": {"node": "node_4", "socket": "data_in_1"}},
                {"from": {"node": "node_3", "socket": "data_out"}, "to": {"node": "node_4", "socket": "data_in_2"}},
                {"from": {"node": "node_4", "socket": "data_out"}, "to": {"node": "node_5", "socket": "data_in"}},
                {"from": {"node": "node_5", "socket": "data_out"}, "to": {"node": "node_6", "socket": "data_in"}},
                {"from": {"node": "node_6", "socket": "data_out"}, "to": {"node": "node_7", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * TEXT PROCESSING SHOWCASES
     */

    /**
     * Find & Replace Pipeline
     * Demonstrates: Text → Find & Replace → Text Output
     */
    addShowcaseFindReplace() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "text",
                    "x": 50,
                    "y": 50,
                    "width": "280px",
                    "height": "150px",
                    "content": {
                        "text": "Hello world, this is a test. Hello again!"
                    }
                },
                {
                    "id": "node_1",
                    "type": "find_replace",
                    "x": 350,
                    "y": 50,
                    "width": "280px",
                    "height": "200px",
                    "content": {
                        "find": "Hello",
                        "replace": "Hi",
                        "regex": false,
                        "global": true,
                        "case_sensitive": false
                    }
                },
                {
                    "id": "node_2",
                    "type": "text",
                    "x": 650,
                    "y": 50,
                    "width": "280px",
                    "height": "150px",
                    "content": {
                        "text": ""
                    }
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_1", "socket": "input_text"}},
                {"from": {"node": "node_1", "socket": "output_text"}, "to": {"node": "node_2", "socket": "text_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * Rendering Features Showcase
     * Demonstrates: Advanced text rendering with markdown, LaTeX, Mermaid, and MusicXML
     */
    addShowcaseRenderingFeatures() {
        const showcaseContent = `# Rendering Showcase

This node demonstrates the various rendering capabilities of this IDE.

---

## Markdown Basics

- **Bold Text:** **This is bold.** - *Italic Text:* *This is italic.* - \`Inline Code:\` \`console.log('hello');\`
- [A Link](https://www.google.com)
- > A blockquote for important notes.

1.  Numbered List Item 1
2.  Numbered List Item 2

---

## LaTeX and MathML

You can write inline LaTeX like the famous equation $E=mc^2$. Or display equations on their own line:

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

---

## Code Block Highlighting

### JavaScript
\`\`\`javascript
// A simple function
function greet(name) {
   const message = \`Hello, \${name}!\`;
   console.log(message);
   return true;
}

greet('World');
\`\`\`

---

## Mermaid Diagrams

\`\`\`mermaid
graph TD;
      A[Start] --> B{Is it working?};
      B -- Yes --> C[Great!];
      B -- No --> D[Fix it!];
      D --> A;
      C --> E[End];
\`\`\`

---

## MusicXML Sheet Music

\`\`\`musicxml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 3.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.0">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
\`\`\``;

        this.ide.clearCanvas();
        const showcaseNode = this.ide.createNode('text', 50, 50, { text: showcaseContent });
        showcaseNode.style.width = '600px';
        showcaseNode.style.height = '700px';
    }

    /**
     * AUTOMATION SHOWCASES
     */

    /**
     * Text Processing Automation
     * Demonstrates: Text → Spell Check → Translation → Sentiment Analysis → Export
     */
    addShowcaseAutomation() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "text",
                    "x": 50,
                    "y": 50,
                    "width": "300px",
                    "height": "150px",
                    "content": {
                        "text": "This is an exampel of some text with a sentance about my great product."
                    }
                },
                {
                    "id": "node_1",
                    "type": "spell_check",
                    "x": 400,
                    "y": 50,
                    "width": "250px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "translation",
                    "x": 400,
                    "y": 250,
                    "width": "250px",
                    "height": "150px",
                    "content": {
                        "targetLang": "es"
                    }
                },
                {
                    "id": "node_3",
                    "type": "sentiment_analysis",
                    "x": 400,
                    "y": 450,
                    "width": "250px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_4",
                    "type": "export",
                    "x": 700,
                    "y": 50,
                    "width": "300px",
                    "height": "100px",
                    "content": {}
                },
                {
                    "id": "node_5",
                    "type": "export",
                    "x": 700,
                    "y": 250,
                    "width": "300px",
                    "height": "100px",
                    "content": {}
                },
                {
                    "id": "node_6",
                    "type": "export",
                    "x": 700,
                    "y": 450,
                    "width": "300px",
                    "height": "100px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_1", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_2", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_3", "socket": "text_in"}},
                {"from": {"node": "node_1", "socket": "text_out"}, "to": {"node": "node_4", "socket": "data_in"}},
                {"from": {"node": "node_2", "socket": "text_out"}, "to": {"node": "node_5", "socket": "data_in"}},
                {"from": {"node": "node_3", "socket": "sentiment"}, "to": {"node": "node_6", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * PUBLISHING SHOWCASES
     */

    /**
     * Multi-Format Publishing
     * Demonstrates: Text → HTML Render → PDF → Email
     */
    addShowcasePublishing() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "text",
                    "x": 50,
                    "y": 150,
                    "width": "350px",
                    "height": "250px",
                    "content": {
                        "text": "<h1>Project Report</h1><p>This is the final report for the project. It includes all the key findings and recommendations.</p><ul><li>Finding 1</li><li>Finding 2</li></ul>"
                    }
                },
                {
                    "id": "node_1",
                    "type": "html_render",
                    "x": 450,
                    "y": 50,
                    "width": "300px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "pdf",
                    "x": 450,
                    "y": 280,
                    "width": "200px",
                    "height": "120px",
                    "content": {}
                },
                {
                    "id": "node_3",
                    "type": "email",
                    "x": 450,
                    "y": 430,
                    "width": "250px",
                    "height": "150px",
                    "content": {
                        "to": "team@example.com",
                        "subject": "Project Report"
                    }
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_1", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_2", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_3", "socket": "text_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * LAYOUT & STRUCTURE SHOWCASES
     */

    /**
     * Container Layout System
     * Demonstrates: Container → Column → Grid → Flex → Tabs → Accordion → Card
     */
    addShowcaseLayoutSystem() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "container",
                    "x": 50,
                    "y": 50,
                    "width": "800px",
                    "height": "600px",
                    "content": {}
                },
                {
                    "id": "node_1",
                    "type": "column",
                    "x": 100,
                    "y": 100,
                    "width": "200px",
                    "height": "500px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "grid",
                    "x": 350,
                    "y": 100,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_3",
                    "type": "flex",
                    "x": 350,
                    "y": 350,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_4",
                    "type": "tabs",
                    "x": 600,
                    "y": 100,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_5",
                    "type": "accordion",
                    "x": 600,
                    "y": 350,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_6",
                    "type": "card",
                    "x": 850,
                    "y": 100,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_7",
                    "type": "sidebar",
                    "x": 850,
                    "y": 350,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_8",
                    "type": "header_footer",
                    "x": 1100,
                    "y": 100,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                },
                {
                    "id": "node_9",
                    "type": "spacer",
                    "x": 1100,
                    "y": 350,
                    "width": "200px",
                    "height": "200px",
                    "content": {}
                }
            ],
            "connections": []
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * UTILITY SHOWCASES
     */

    /**
     * Template and Macro System
     * Demonstrates: Template → Macro → Export
     */
    addShowcaseTemplateMacro() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "text",
                    "x": 50,
                    "y": 50,
                    "width": "300px",
                    "height": "150px",
                    "content": {
                        "text": "{\"name\": \"John Doe\", \"balance\": 1000, \"currency\": \"USD\"}"
                    }
                },
                {
                    "id": "node_1",
                    "type": "template",
                    "x": 400,
                    "y": 50,
                    "width": "300px",
                    "height": "200px",
                    "content": {
                        "template": "Hello {{name}}, your balance is {{currency}}{{balance}}.",
                        "variables": "{}"
                    }
                },
                {
                    "id": "node_2",
                    "type": "macro",
                    "x": 750,
                    "y": 50,
                    "width": "300px",
                    "height": "200px",
                    "content": {
                        "steps": "[{\"node\": \"find_replace\", \"params\": {\"find\": \"USD\", \"replace\": \"$\"}}]"
                    }
                },
                {
                    "id": "node_3",
                    "type": "export",
                    "x": 1100,
                    "y": 50,
                    "width": "300px",
                    "height": "200px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_1", "socket": "data_in"}},
                {"from": {"node": "node_1", "socket": "text_out"}, "to": {"node": "node_2", "socket": "input_data"}},
                {"from": {"node": "node_2", "socket": "output_data"}, "to": {"node": "node_3", "socket": "data_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * Media Processing Pipeline
     * Demonstrates: OCR → TTS → QR Code → Social Share → Screenshot → Print
     */
    addShowcaseMediaProcessing() {
        const showcaseData = {
            "nodes": [
                {
                    "id": "node_0",
                    "type": "text",
                    "x": 50,
                    "y": 50,
                    "width": "300px",
                    "height": "150px",
                    "content": {
                        "text": "Sample text for media processing demonstration"
                    }
                },
                {
                    "id": "node_1",
                    "type": "ocr",
                    "x": 400,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_2",
                    "type": "tts",
                    "x": 400,
                    "y": 250,
                    "width": "200px",
                    "height": "150px",
                    "content": {
                        "voice": "Google US English",
                        "rate": 1,
                        "pitch": 1
                    }
                },
                {
                    "id": "node_3",
                    "type": "qr_code",
                    "x": 650,
                    "y": 50,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_4",
                    "type": "social_share",
                    "x": 650,
                    "y": 250,
                    "width": "200px",
                    "height": "150px",
                    "content": {}
                },
                {
                    "id": "node_5",
                    "type": "screenshot",
                    "x": 900,
                    "y": 50,
                    "width": "200px",
                    "height": "120px",
                    "content": {}
                },
                {
                    "id": "node_6",
                    "type": "print",
                    "x": 900,
                    "y": 220,
                    "width": "200px",
                    "height": "120px",
                    "content": {}
                }
            ],
            "connections": [
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_1", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_2", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_3", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_4", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_5", "socket": "text_in"}},
                {"from": {"node": "node_0", "socket": "text_out"}, "to": {"node": "node_6", "socket": "text_in"}}
            ]
        };
        this.loadShowcase(JSON.stringify(showcaseData));
    }

    /**
     * Get all available showcases organized by category
     */
    getAllShowcases() {
        return {
            'Data Processing': [
                { name: 'CSV Processing Pipeline', method: this.addShowcaseCSVProcessing.bind(this) },
                { name: 'JSON Transform Pipeline', method: this.addShowcaseJSONTransform.bind(this) },
                { name: 'Data Analysis Pipeline', method: this.addShowcaseDataAnalysis.bind(this) },
                { name: 'Complex Data Pipeline', method: this.addShowcaseComplexPipeline.bind(this) }
            ],
            'Text Processing': [
                { name: 'Find & Replace Pipeline', method: this.addShowcaseFindReplace.bind(this) },
                { name: 'Rendering Features', method: this.addShowcaseRenderingFeatures.bind(this) }
            ],
            'Automation': [
                { name: 'Text Processing Automation', method: this.addShowcaseAutomation.bind(this) }
            ],
            'Publishing': [
                { name: 'Multi-Format Publishing', method: this.addShowcasePublishing.bind(this) }
            ],
            'Layout & Structure': [
                { name: 'Container Layout System', method: this.addShowcaseLayoutSystem.bind(this) }
            ],
            'Utilities': [
                { name: 'Template and Macro System', method: this.addShowcaseTemplateMacro.bind(this) },
                { name: 'Media Processing Pipeline', method: this.addShowcaseMediaProcessing.bind(this) }
            ]
        };
    }
}

// Export for use in the main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeShowcases;
}