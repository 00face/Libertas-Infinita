/**
 * Converts a patterns object into a string that can be safely embedded in an iframe's script.
 * This is necessary because JSON.stringify doesn't handle RegExp objects well, and
 * RegExp.toString() can produce strings that break the HTML parser (e.g., containing "</").
 * @param {object} patterns - The syntax highlighting patterns.
 * @returns {string} - A string representation of the patterns object.
 * Race conditions are still an issue.
 */
function serializePatternsForIframe(patterns) {
    const langParts = [];
    for (const lang in patterns) {
        if (Object.hasOwnProperty.call(patterns, lang)) {
            const rules = patterns[lang].map(rule => {
                // Escape the forward slash in any `</` sequence to prevent the HTML parser
                // from prematurely closing the script tag.
                const patternString = rule.pattern.toString().replace(/<\//g, '<\\/');
                return `{type: ${JSON.stringify(rule.type)}, pattern: ${patternString}}`;
            }).join(', ');
            langParts.push(`${JSON.stringify(lang)}: [${rules}]`);
        }
    }
    return `{${langParts.join(', ')}}`;
}

const customSyntaxHighlighter = {
    getThemeColors: (theme) => {
        const isLight = theme === 'light';
        // Color scheme inspired by Atom One themes
        return {
            '--syntax-control': isLight ? '#a626a4' : '#c678dd',
            '--syntax-declaration': isLight ? '#e45649' : '#e06c75',
            '--syntax-string': isLight ? '#50a14f' : '#98c379',
            '--syntax-number': isLight ? '#986801' : '#d19a66',
            '--syntax-function': isLight ? '#4078f2' : '#61afef',
            '--syntax-type': isLight ? '#c18401' : '#e5c07b',
            '--syntax-variable': isLight ? '#383a42' : '#abb2bf',
            '--syntax-comment': isLight ? '#a0a1a7' : '#5c6370',
            '--syntax-operator': isLight ? '#0184bc' : '#56b6c2',
            '--syntax-punctuation': isLight ? '#383a42' : '#abb2bf',
            '--syntax-background': isLight ? '#f0f0f0' : '#21252b'
        };
    },
    
    patterns: {
        javascript: [
            { type: 'comment', pattern: /\/\*[\s\S]*?\*\/|\/\/.*/g },
            { type: 'string', pattern: /(`|'|")(?:\\.|(?!\1).)*\1/g },
            { type: 'control', pattern: /\b(if|else|for|while|do|switch|case|default|return|break|continue|try|catch|finally|throw|async|await|of|in)\b/g },
            { type: 'declaration', pattern: /\b(const|let|var|function|class|extends|import|export|from|default|new)\b/g },
            { type: 'number', pattern: /\b(true|false|null|undefined|NaN|Infinity|\d+(?:\.\d+)?)\b/g },
            { type: 'function', pattern: /[a-zA-Z_]\w*(?=\s*\()/g },
            { type: 'type', pattern: /\b([A-Z][a-zA-Z0-9_]*)\b/g },
            { type: 'operator', pattern: /[+\-*/%&|^=<>!~?:,;.]/g },
            { type: 'punctuation', pattern: /[{}[\]()]/g }
        ],
        css: [
            { type: 'comment', pattern: /\/\*[\s\S]*?\*\//g },
            { type: 'string', pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
            { type: 'type', pattern: /@media|@keyframes|@font-face/g },
            { type: 'number', pattern: /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})|\b\d+(?:\.\d+)?(px|em|rem|%|vw|vh)\b/g },
            { type: 'function', pattern: /[a-z-]+(?=\()/g },
            { type: 'declaration', pattern: /(?:[a-zA-Z-]+)(?=:)/g },
            { type: 'variable', pattern: /([.#&]?-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g },
            { type: 'operator', pattern: /[:;]/g },
            { type: 'punctuation', pattern: /[{}[\]()]/g }
        ],
        html: [
            { type: 'comment', pattern: /<!--[\s\S]*?-->/g },
            { type: 'type', pattern: /<!DOCTYPE[^>]+>/gi },
            { type: 'declaration', pattern: /(?<=<\/?)(\w+)/g }, // Tag name
            { type: 'function', pattern: /([a-zA-Z-]+)(?=\s*=)/g }, // Attribute name
            { type: 'string', pattern: /"([^"]*)"|'([^']*)'/g }, // Attribute value
            { type: 'operator', pattern: /[=<>\/]/g }
        ]
    },

    highlight: function(code, language) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        if (language === 'html') {
            const styleRegex = /<style>([\s\S]*?)<\/style>/gi;
            const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
            
            const placeholders = {};
            let placeholderId = 0;

            code = code.replace(styleRegex, (match, cssCode) => {
                const id = `__placeholder_${placeholderId++}__`;
                placeholders[id] = `<style>${this.highlight(cssCode, 'css')}</style>`;
                return id;
            });

            code = code.replace(scriptRegex, (match, jsCode) => {
                const id = `__placeholder_${placeholderId++}__`;
                placeholders[id] = '<script>' + this.highlight(jsCode, 'javascript') + '</scr' + 'ipt>';
                return id;
            });
            
            let highlightedHtml = this.tokenizeAndHighlight(code, language, escapeHtml);

            for (const id in placeholders) {
                highlightedHtml = highlightedHtml.replace(id, placeholders[id]);
            }
            return highlightedHtml;
        }
        
        return this.tokenizeAndHighlight(code, language, escapeHtml);
    },
    
    tokenizeAndHighlight: function(code, language, escapeHtml) {
        const patterns = this.patterns[language] || [];
        if (!patterns.length) return escapeHtml(code);

        let allMatches = [];
        patterns.forEach(rule => {
            for (const match of code.matchAll(rule.pattern)) {
                allMatches.push({
                    type: rule.type,
                    content: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        });

        allMatches.sort((a, b) => a.start - b.start);

        let result = '';
        let lastIndex = 0;

        allMatches.forEach(match => {
            if (match.start < lastIndex) return;

            if (match.start > lastIndex) {
                result += escapeHtml(code.slice(lastIndex, match.start));
            }

            const escapedContent = escapeHtml(match.content);
            result += `<span class="token-${match.type}">${escapedContent}</span>`;
            
            lastIndex = match.end;
        });

        if (lastIndex < code.length) {
            result += escapeHtml(code.slice(lastIndex));
        }

        return result;
    }
};

class NodeBasedIDE {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.world = document.getElementById('world');
        this.sidebar = document.getElementById('properties-sidebar');
        this.sidebarContent = document.getElementById('sidebar-content');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.connectionsContainer = document.getElementById('connections');
        this.selectionRect = document.getElementById('selection-rect');

        this.nodes = new Map();
        this.connections = [];
        this.nodeCounter = 0;
        
        this.selectedNodes = new Set();
        this.draggedNode = null;
        this.draggedNodesInitialPositions = new Map();
        this.dragOffset = { x: 0, y: 0 };
        
        this.canvasOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.minZoom = 0.2;
        this.maxZoom = 2.5;
        
        this.isPanning = false;
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };
        
        this.connectionStart = null;
        this.tempConnection = null;
        this.SVG_NS = 'http://www.w3.org/2000/svg';
        
        this.selectionMode = 'pointer'; // 'pointer', 'rect-select'

        this.history = {
            undoStack: [],
            redoStack: [],
            maxHistory: 50,
            isRestoring: false
        };

        this.typo = null;
        this.typoLoading = false;
        this.typoLoaded = false;
        this.tesseractWorker = null;
        this.tesseractLoading = false;
        this.tesseractLoaded = false;
        
        this.nodeProcessors = {
            text: this.processTextNode.bind(this),
            find_replace: this.processFindReplaceNode.bind(this),
            import: this.processImportNode.bind(this),
            export: this.processExportNode.bind(this),
            csv: this.processCsvNode.bind(this),
            json: this.processJsonNode.bind(this),
            xml: this.processXmlNode.bind(this),
            filter: this.processFilterNode.bind(this),
            transform: this.processTransformNode.bind(this),
            merge: this.processMergeNode.bind(this),
            split: this.processSplitNode.bind(this),
            aggregate: this.processAggregateNode.bind(this),
            
            // Automation Nodes
            spell_check: this.processSpellCheckNode.bind(this),
            translation: this.processTranslationNode.bind(this),
            summarization: this.processSummarizationNode.bind(this),
            sentiment_analysis: this.processSentimentAnalysisNode.bind(this),
            auto_format: this.processAutoFormatNode.bind(this),
            template: this.processTemplateNode.bind(this),
            macro: this.processMacroNode.bind(this),
            ocr: this.processOcrNode.bind(this),
            tts: this.processTtsNode.bind(this),

            // Publishing Nodes
            email: this.processEmailNode.bind(this),
            pdf: this.processPdfNode.bind(this),
            html_render: this.processHtmlRenderNode.bind(this),
            qr_code: this.processQrCodeNode.bind(this),
            social_share: this.processSocialShareNode.bind(this),
            screenshot: this.processScreenshotNode.bind(this),
            print: this.processPrintNode.bind(this),
        };

        this.initLibraries();
        this.initEventListeners();
        this.recordState("Initial State");
    }

    async initLibraries() {
        const renderer = new marked.Renderer();
        renderer.code = (code, lang) => {
            const langLower = (lang || '').toLowerCase();
            if (langLower === 'mermaid') {
                return `<div class="mermaid">${code}</div>`;
            }
            if (langLower === 'musicxml') {
                return `<div class="musicxml-placeholder" data-musicxml="${encodeURIComponent(code)}">Loading Music...</div>`;
            }
            if (langLower === 'mathml') {
                return code;
            }
            return `<pre class="language-${langLower}" data-lang="${langLower}"><code>${this.escapeHtml(code)}</code></pre>`;
        };

        marked.setOptions({ renderer });
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        
        // Initialize TTS (no external library needed)
        this.speech = new SpeechSynthesisUtterance();
        this.speech.rate = 1.0;
        this.speech.pitch = 1.0;
        this.speech.volume = 1.0;
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.target === this.canvas || e.target === this.world || e.target === this.connectionsContainer) {
                    if (!e.ctrlKey) {
                        this.deselectAll();
                    }
                const canvasRect = this.canvas.getBoundingClientRect();

                if (this.selectionMode === 'rect-select') {
                    this.isSelecting = true;
                    this.selectionRect.style.display = 'block';
                    this.selectionStart.x = e.clientX - canvasRect.left;
                    this.selectionStart.y = e.clientY - canvasRect.top;
                    this.selectionRect.style.left = `${this.selectionStart.x}px`;
                    this.selectionRect.style.top = `${this.selectionStart.y}px`;
                    this.selectionRect.style.width = '0px';
                    this.selectionRect.style.height = '0px';
                } else { // Pointer mode
                    this.isPanning = true;
                    this.panStart = { x: e.clientX, y: e.clientY };
                    this.canvas.classList.add('panning');
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            }
        });

        document.addEventListener('mousemove', (e) => {
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            if (this.isPanning) {
                const dx = e.clientX - this.panStart.x;
                const dy = e.clientY - this.panStart.y;
                this.panStart = { x: e.clientX, y: e.clientY };
                this.canvasOffset.x += dx;
                this.canvasOffset.y += dy;
                this.updateWorldTransform();
            }
            
            if (this.isSelecting) {
                const left = Math.min(this.selectionStart.x, mouseX);
                const top = Math.min(this.selectionStart.y, mouseY);
                const width = Math.abs(this.selectionStart.x - mouseX);
                const height = Math.abs(this.selectionStart.y - mouseY);

                this.selectionRect.style.left = `${left}px`;
                this.selectionRect.style.top = `${top}px`;
                this.selectionRect.style.width = `${width}px`;
                this.selectionRect.style.height = `${height}px`;

                this.checkSelection(this.selectionRect.getBoundingClientRect());
            }
            
            if (this.draggedNode) {
                let newX = (mouseX - this.dragOffset.x - this.canvasOffset.x) / this.scale;
                let newY = (mouseY - this.dragOffset.y - this.canvasOffset.y) / this.scale;

                const dx = newX - this.draggedNodesInitialPositions.get(this.draggedNode.id).x;
                const dy = newY - this.draggedNodesInitialPositions.get(this.draggedNode.id).y;

                this.selectedNodes.forEach(nodeId => {
                    const nodeData = this.nodes.get(nodeId);
                    const initialPos = this.draggedNodesInitialPositions.get(nodeId);
                    if (nodeData && initialPos) {
                        nodeData.element.style.left = (initialPos.x + dx) + 'px';
                        nodeData.element.style.top = (initialPos.y + dy) + 'px';
                    }
                });

                this.handleDragOver(e);
                this.updateConnections();
            }

            if (this.tempConnection) {
                this.updateTempConnection(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.selectionRect.style.display = 'none';
                this.selectionRect.style.width = '0px';
                this.selectionRect.style.height = '0px';
            }
            
            if (this.draggedNode) {
                this.handleDrop(e);
                this.recordState("Move Node");
                this.draggedNode = null;
                this.draggedNodesInitialPositions.clear();
            }
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.classList.remove('panning');
            }
            if (this.tempConnection) {
                this.tempConnection.remove();
                this.tempConnection = null;
            }
            this.connectionStart = null;
        });

        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas || e.target === this.world) {
                if (!e.ctrlKey) this.deselectAll();
            }
        });

        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e), { passive: false });
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
        
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());

        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        document.getElementById('save-btn').addEventListener('click', () => this.saveSession());
        document.getElementById('load-btn').addEventListener('click', () => document.getElementById('load-file-input').click());
        document.getElementById('load-file-input').addEventListener('change', (e) => this.loadSession(e));
        document.getElementById('add-node-btn').addEventListener('click', () => this.showAddNodeSidebar());

        // Tool selection listeners
        document.getElementById('pointer-tool').addEventListener('click', () => this.setSelectionMode('pointer'));
        document.getElementById('rect-select-tool').addEventListener('click', () => this.setSelectionMode('rect-select'));

        this.connectionsContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = e.target.closest('[data-conn-index]');
            if (target) {
                const index = parseInt(target.dataset.connIndex, 10);
                const removedConn = this.connections.splice(index, 1)[0];
                this.recordState("Delete Connection");
                this.updateConnections();
                this.updateSocketStates();
                if (removedConn) {
                   this.processNodeData(removedConn.to.node);
                }
            }
        });
    }
    
    setSelectionMode(mode) {
        this.selectionMode = mode;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`${mode}-tool`);
        if(activeBtn) activeBtn.classList.add('active');

        if (mode === 'pointer') {
            this.canvas.style.cursor = 'grab';
        } else if (mode === 'rect-select') {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    updateWorldTransform() {
        this.world.style.transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px) scale(${this.scale})`;
        document.getElementById('zoom-level').textContent = `${Math.round(this.scale * 100)}%`;
    }

    handleZoom(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -1 : 1;
        const oldScale = this.scale;
        
        this.scale += delta * zoomSpeed * this.scale;
        this.scale = Math.max(this.minZoom, Math.min(this.maxZoom, this.scale));

        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        this.canvasOffset.x = mouseX - (mouseX - this.canvasOffset.x) * (this.scale / oldScale);
        this.canvasOffset.y = mouseY - (mouseY - this.canvasOffset.y) * (this.scale / oldScale);
        
        this.updateWorldTransform();
    }

    zoom(factor) {
        const oldScale = this.scale;
        this.scale *= factor;
        this.scale = Math.max(this.minZoom, Math.min(this.maxZoom, this.scale));
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;

        this.canvasOffset.x = centerX - (centerX - this.canvasOffset.x) * (this.scale / oldScale);
        this.canvasOffset.y = centerY - (centerY - this.canvasOffset.y) * (this.scale / oldScale);

        this.updateWorldTransform();
    }

    zoomIn() { this.zoom(1.2); }
    zoomOut() { this.zoom(1 / 1.2); }
    resetZoom() {
        this.scale = 1;
        this.canvasOffset = { x: 0, y: 0 };
        this.updateWorldTransform();
    }

    toggleSidebar() {
        const isCollapsed = this.sidebar.classList.toggle('collapsed');
        this.sidebarToggle.innerHTML = isCollapsed ? '&raquo;' : '&laquo;';
    }
    
    createNode(type, x, y, options = {}) {
        const nodeId = options.id || 'node_' + this.nodeCounter++;
        if (parseInt(nodeId.split('_')[1]) >= this.nodeCounter) {
            this.nodeCounter = parseInt(nodeId.split('_')[1]) + 1;
        }

        const node = document.createElement('div');
        node.className = 'node';
        node.id = nodeId;
        node.dataset.type = type;
        node.style.left = x + 'px';
        node.style.top = y + 'px';
        if (options.width) node.style.width = options.width;
        if (options.height) node.style.height = options.height;

        let nodeContentHTML = '';
        const nodeData = { 
            element: node, type, inputs: {}, outputs: {},
            properties: {}, codeBlockProperties: {},
            isContainer: false,
            children: options.children || [],
            parentId: options.parentId || null,
            state: options.state || {}
        };
        
        const nodeCreators = {
            'text': this.createTextNodeContent,
            'find_replace': this.createFindReplaceNodeContent,
            'import': this.createImportNodeContent,
            'export': this.createExportNodeContent,
            'csv': this.createCsvNodeContent,
            'json': this.createJsonNodeContent,
            'xml': this.createXmlNodeContent,
            'filter': this.createFilterNodeContent,
            'transform': this.createTransformNodeContent,
            'merge': this.createMergeNodeContent,
            'split': this.createSplitNodeContent,
            'aggregate': this.createAggregateNodeContent,
            'container': this.createContainerNodeContent,
            'column': this.createColumnNodeContent,
            'grid': this.createPlaceholderNodeContent,
            'flex': this.createPlaceholderNodeContent,
            'tabs': this.createPlaceholderNodeContent,
            'accordion': this.createPlaceholderNodeContent,
            'card': this.createPlaceholderNodeContent,
            'sidebar': this.createPlaceholderNodeContent,
            'header_footer': this.createPlaceholderNodeContent,
            'spacer': this.createPlaceholderNodeContent,
            'spell_check': this.createSpellCheckNodeContent,
            'translation': this.createTranslationNodeContent,
            'summarization': this.createSummarizationNodeContent,
            'sentiment_analysis': this.createSentimentAnalysisNodeContent,
            'auto_format': this.createAutoFormatNodeContent,
            'template': this.createTemplateNodeContent,
            'macro': this.createMacroNodeContent,
            'ocr': this.createOcrNodeContent,
            'tts': this.createTtsNodeContent,
            'email': this.createEmailNodeContent,
            'pdf': this.createPdfNodeContent,
            'html_render': this.createHtmlRenderNodeContent,
            'qr_code': this.createQrCodeNodeContent,
            'social_share': this.createSocialShareNodeContent,
            'screenshot': this.createScreenshotNodeContent,
            'print': this.createPrintNodeContent,
        };

        const layoutNodeTypes = ['container', 'column', 'grid', 'flex', 'tabs', 'accordion', 'card', 'sidebar', 'header_footer'];
        if (layoutNodeTypes.includes(type)) {
            node.classList.add('is-container');
            nodeData.isContainer = true;
        }

        if (nodeCreators[type]) {
            nodeContentHTML = nodeCreators[type].call(this, { ...options, nodeId, type });
        }

        if (type === 'text') {
            const defaultTextColor = '#abb2bf';
            const defaultAccentColor = '#61afef';
            const defaultMutedColor = '#5c6370';
            const defaultTertiaryBg = '#3a3a3a';

            nodeData.properties = options.properties || {
                fontSize: 12, color: defaultTextColor,
                h1: { color: defaultAccentColor, fontSize: 32 }, h2: { color: defaultAccentColor, fontSize: 24 },
                h3: { color: defaultAccentColor, fontSize: 20 }, h4: { color: defaultAccentColor, fontSize: 16 },
                h5: { color: defaultAccentColor, fontSize: 14 }, h6: { color: defaultAccentColor, fontSize: 12 },
                strong: { color: defaultTextColor }, em: { color: defaultTextColor },
                blockquote: { color: defaultMutedColor, borderColor: defaultAccentColor },
                a: { color: defaultAccentColor },
                code: { color: defaultTextColor, backgroundColor: defaultTertiaryBg },
                hr: { color: defaultMutedColor },
                ul: { color: defaultTextColor }, ol: { color: defaultTextColor }, li: { color: defaultTextColor },
                table: { borderColor: defaultMutedColor }, th: { backgroundColor: defaultTertiaryBg },
            };
            
            nodeData.codeBlockProperties = options.codeBlockProperties || {
                fontSize: 12,
                syntaxTheme: 'dark'
            };
        }

        node.innerHTML = nodeContentHTML;
        this.world.appendChild(node);
        this.nodes.set(nodeId, nodeData);

        this.setupNodeEvents(node);
        
        if (!options.fromSerialization) {
            this.recordState("Create Node");
        }
        return node;
    }
    
    createTextNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Text Node</span>
                <div class="node-controls"><button class="mini-btn" onclick="ide.togglePreview('${options.nodeId}')">Preview</button></div>
            </div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="text-content-wrapper">
                    <textarea placeholder="Enter text..." data-output="text_out">${options.text || ''}</textarea>
                </div>
                <div class="node-preview">
                    <iframe sandbox="allow-scripts"></iframe>
                </div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createFindReplaceNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Find & Replace</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="input_text"></div><span>Text In</span></div>
                <div class="find-replace-row"><input type="text" placeholder="Find..." data-param="find" value="${options.find || ''}" style="flex: 1;"></div>
                <div class="find-replace-row"><input type="text" placeholder="Replace with..." data-param="replace" value="${options.replace || ''}" style="flex: 1;"></div>
                <div class="find-replace-options">
                    <label class="checkbox-label"><input type="checkbox" data-param="regex" ${options.regex ? 'checked' : ''}> Regex</label>
                    <label class="checkbox-label"><input type="checkbox" data-param="global" ${options.global !== false ? 'checked' : ''}> Global</label>
                    <label class="checkbox-label"><input type="checkbox" data-param="case_sensitive" ${options.case_sensitive ? 'checked' : ''}> Case Sensitive</label>
                </div>
                <div class="regex-tester"><div style="font-weight: bold; margin-bottom: 4px;">Regex Tester</div><div class="regex-matches" data-matches></div></div>
                <div class="node-status"></div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="output_text"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createImportNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Import Data</span></div>
            <div class="node-content">
                <div class="text-content-wrapper">
                    <textarea placeholder="Paste your data here..." data-output="data_out">${options.data_out || options.text || ''}</textarea>
                </div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createExportNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Export Data</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <div class="text-content-wrapper">
                    <textarea readonly placeholder="Output will appear here..."></textarea>
                </div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createCsvNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">CSV Parser</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="csv_in"></div><span>CSV In</span></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createJsonNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">JSON Processor</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <div class="node-param-row">
                    <select data-param="operation">
                        <option value="parse" ${options.operation === 'parse' ? 'selected' : ''}>Parse Text</option>
                        <option value="stringify" ${options.operation === 'stringify' ? 'selected' : ''}>Stringify Object</option>
                    </select>
                </div>
                <div class="node-status"></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createXmlNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">XML Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="xml_in"></div><span>XML In</span></div>
                <div class="node-status">Note: XML parsing not yet implemented.</div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createSplitNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Split Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <div class="node-status">Note: Split logic not yet implemented.</div>
                <div class="node-output"><span>Data Out 1</span><div class="socket output text-type" data-socket="data_out_1"></div></div>
                <div class="node-output"><span>Data Out 2</span><div class="socket output text-type" data-socket="data_out_2"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createFilterNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Filter Data</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <textarea data-param="condition" placeholder="Filter condition (e.g., row.age > 30)">${options.condition || ''}</textarea>
                <div class="node-status" style="margin-top: 8px;"></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createTransformNodeContent(options) {
        const defaultLogic = `// Modify the 'row' object and return it.\n// Example: return { ...row, new_prop: 'value' };\nreturn row;`;
        return `
            <div class="node-header"><span class="node-title">Transform Data</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <textarea data-param="logic" placeholder="Enter transform logic...">${options.logic || defaultLogic}</textarea>
                <div class="node-status" style="margin-top: 8px;"></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createMergeNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Merge Data</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in_1"></div><span>Data In 1 (Left)</span></div>
                <div class="node-input"><div class="socket input text-type" data-socket="data_in_2"></div><span>Data In 2 (Right)</span></div>
                <div class="node-param-row">
                    <input type="text" data-param="key" placeholder="Join Key (e.g., id or left_id=right_id)" value="${options.key || ''}">
                </div>
                    <div class="node-status"></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createAggregateNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Aggregate Data</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data In</span></div>
                <div class="node-param-row">
                        <input type="text" data-param="groupBy" placeholder="Group By Key" value="${options.groupBy || ''}">
                </div>
                <div class="node-param-row">
                        <select data-param="aggFunc">
                            <option value="sum" ${options.aggFunc === 'sum' ? 'selected' : ''}>Sum</option>
                            <option value="count" ${options.aggFunc === 'count' ? 'selected' : ''}>Count</option>
                            <option value="avg" ${options.aggFunc === 'avg' ? 'selected' : ''}>Average</option>
                        </select>
                        <input type="text" data-param="aggKey" placeholder="Of Key" value="${options.aggKey || ''}">
                </div>
                <div class="node-status"></div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="data_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createSpellCheckNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Spell Check Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="text-content-wrapper">
                    <textarea readonly placeholder="Corrected text will appear here...">${options.text || ''}</textarea>
                </div>
                <div class="node-status"></div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createTranslationNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Translation Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="node-param-row">
                    <select data-param="targetLang">
                        <option value="es" ${options.targetLang === 'es' ? 'selected' : ''}>Spanish</option>
                        <option value="fr" ${options.targetLang === 'fr' ? 'selected' : ''}>French</option>
                        <option value="de" ${options.targetLang === 'de' ? 'selected' : ''}>German</option>
                        <option value="ja" ${options.targetLang === 'ja' ? 'selected' : ''}>Japanese</option>
                    </select>
                    <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')">Translate</button>
                </div>
                <div class="text-content-wrapper">
                    <textarea readonly placeholder="Translated text will appear here...">${options.text || ''}</textarea>
                </div>
                <div class="node-status"></div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createSummarizationNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Summarization Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="text-content-wrapper">
                    <textarea readonly placeholder="Summarized text will appear here...">${options.text || ''}</textarea>
                </div>
                <div class="node-status">Note: A real-time summarization model requires a large backend. This is a placeholder.</div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createSentimentAnalysisNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Sentiment Analysis</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="node-param-row">
                    <input type="text" readonly placeholder="Sentiment Score: 0.0" data-output="sentimentScore" value="${options.sentimentScore || ''}">
                </div>
                <div class="node-param-row">
                    <input type="text" readonly placeholder="Sentiment: N/A" data-output="sentimentLabel" value="${options.sentimentLabel || ''}">
                </div>
                <div class="node-status">Note: Requires a large ML model. This is a placeholder.</div>
                <div class="node-output"><span>Sentiment</span><div class="socket output special-type" data-socket="sentiment"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createAutoFormatNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Auto-Format Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="node-param-row">
                   <select data-param="formatType">
                       <option value="js" ${options.formatType === 'js' ? 'selected' : ''}>JavaScript</option>
                       <option value="html" ${options.formatType === 'html' ? 'selected' : ''}>HTML</option>
                       <option value="css" ${options.formatType === 'css' ? 'selected' : ''}>CSS</option>
                       <option value="json" ${options.formatType === 'json' ? 'selected' : ''}>JSON</option>
                   </select>
                </div>
                <div class="text-content-wrapper">
                    <textarea readonly placeholder="Formatted code will appear here...">${options.text || ''}</textarea>
                </div>
                <div class="node-status"></div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createTemplateNodeContent(options) {
        const template = options.template || 'Hello {{name}}, your balance is ${{balance}}.';
        const variables = options.variables || '{}';
        return `
            <div class="node-header"><span class="node-title">Template Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="template_in"></div><span>Template</span></div>
                <div class="node-input"><div class="socket input text-type" data-socket="data_in"></div><span>Data (JSON)</span></div>
                <textarea data-param="template" placeholder="Enter template string...">${template}</textarea>
                <textarea data-param="variables" placeholder="Enter variables (JSON)...">${variables}</textarea>
                <div class="node-status"></div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createMacroNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Macro Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="input_data"></div><span>Data In</span></div>
                <textarea data-param="steps" placeholder="Enter JSON array of steps...">${options.steps || `// Example: [{ "node": "find_replace", "params": { "find": "old", "replace": "new" } }]`}</textarea>
                <div class="node-status">Note: This is a placeholder for a complex feature.</div>
                <div class="node-output"><span>Data Out</span><div class="socket output text-type" data-socket="output_data"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createOcrNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">OCR Node</span></div>
            <div class="node-content">
                <img id="ocr-image-preview" style="display: none;">
                <button class="mini-btn" onclick="document.getElementById('ocr-file-input').click()">Load Image</button>
                <div class="node-status"></div>
                <div class="text-content-wrapper" style="margin-top: 8px;">
                    <textarea readonly placeholder="Detected text will appear here...">${options.text || ''}</textarea>
                </div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createTtsNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">TTS Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="node-param-row">
                   <input type="text" data-param="voice" placeholder="Voice (e.g., 'Google US English')" value="${options.voice || ''}">
                   <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')">Speak</button>
                </div>
                <div class="node-status"></div>
                <div id="tts-controls">
                    <input type="range" min="0.1" max="10" step="0.1" data-param="rate" value="${options.rate || 1}" title="Rate">
                    <input type="range" min="0" max="2" step="0.1" data-param="pitch" value="${options.pitch || 1}" title="Pitch">
                </div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createEmailNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Email Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <input type="text" data-param="to" placeholder="To: recipient@example.com" value="${options.to || ''}">
                <input type="text" data-param="subject" placeholder="Subject" value="${options.subject || ''}" style="margin-top: 4px;">
                <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')" style="margin-top: 8px;">Send</button>
                <div class="node-status" style="margin-top: 8px;"></div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createPdfNodeContent(options) {
       return `
            <div class="node-header"><span class="node-title">PDF Render Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')" style="margin-top: 8px;">Render PDF</button>
                <div class="node-status"></div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createHtmlRenderNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">HTML Render Node</span>
                <div class="node-controls"><button class="mini-btn" onclick="ide.togglePreview('${options.nodeId}')">Preview</button></div>
            </div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="text-content-wrapper">
                    <textarea placeholder="Enter HTML/CSS/JS here..." data-output="text_out">${options.text || ''}</textarea>
                </div>
                <div class="node-preview">
                    <iframe sandbox="allow-scripts allow-modals"></iframe>
                </div>
                <div class="node-output"><span>Text Out</span><div class="socket output text-type" data-socket="text_out"></div></div>
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createQrCodeNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">QR Code Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <div class="qr-code-container" data-qr-container></div>
                <div class="node-status"></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createSocialShareNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Social Share</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text/URL In</span></div>
                <div class="social-share-buttons">
                    <button class="mini-btn" data-share="twitter">Twitter</button>
                    <button class="mini-btn" data-share="facebook">Facebook</button>
                    <button class="mini-btn" data-share="linkedin">LinkedIn</button>
                </div>
                <div class="node-status"></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createScreenshotNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Screenshot Node</span></div>
            <div class="node-content">
                <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')">Take Screenshot</button>
                <div class="node-status"></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createPrintNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Print Node</span></div>
            <div class="node-content">
                <div class="node-input"><div class="socket input text-type" data-socket="text_in"></div><span>Text In</span></div>
                <button class="mini-btn" onclick="ide.processNodeData('${options.nodeId}')">Print</button>
                <div class="node-status"></div>
            </div>
            <div class="resize-handle"></div>`;
    }

    createContainerNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Container</span></div>
            <div class="node-content">
            </div>
            <div class="resize-handle"></div>`;
    }
    
    createColumnNodeContent(options) {
        return `
            <div class="node-header"><span class="node-title">Column</span></div>
            <div class="node-content">
            </div>
            <div class="resize-handle"></div>`;
    }

    createPlaceholderNodeContent(options) {
        const title = options.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
            <div class="node-header"><span class="node-title">${title} Node</span></div>
            <div class="node-content">
                <p style="font-size: 11px; color: var(--text-muted); margin: 10px 0;">Functionality for this node is not yet implemented.</p>
            </div>
            <div class="resize-handle"></div>`;
    }

    async togglePreview(nodeId) {
        const nodeData = this.nodes.get(nodeId);
        if (!nodeData || (nodeData.type !== 'text' && nodeData.type !== 'html_render')) return;
        const nodeElement = nodeData.element;
        const previewButton = nodeElement.querySelector('.node-controls .mini-btn');
        const isPreview = nodeElement.classList.toggle('preview-mode');
        const iframe = nodeElement.querySelector('.node-preview iframe');

        if (isPreview) {
            previewButton.textContent = 'Edit';
            const textarea = nodeElement.querySelector('textarea');
            const content = textarea.value;
            let parsedContent = '';
            if (nodeData.type === 'text') {
                parsedContent = DOMPurify.sanitize(marked.parse(content), {
                    ADD_TAGS: ['math', 'mrow', 'mi', 'mo', 'mfrac', 'msqrt', 'msup', 'mn']
                });
            } else if (nodeData.type === 'html_render') {
                parsedContent = DOMPurify.sanitize(content);
            }

            const mermaidTheme = (['dark', 'dracula', 'tokyonight', 'monokai', 'solarized'].includes(document.body.getAttribute('data-theme'))) ? 'dark' : 'default';
            
            const syntaxTheme = nodeData.codeBlockProperties?.syntaxTheme || 'dark';
            const syntaxColors = customSyntaxHighlighter.getThemeColors(syntaxTheme);

            const syntaxHighlightingStyles = `
                .token-comment { color: ${syntaxColors['--syntax-comment']}; }
                .token-string { color: ${syntaxColors['--syntax-string']}; }
                .token-control { color: ${syntaxColors['--syntax-control']}; }
                .token-declaration { color: ${syntaxColors['--syntax-declaration']}; }
                .token-number { color: ${syntaxColors['--syntax-number']}; }
                .token-function { color: ${syntaxColors['--syntax-function']}; }
                .token-type { color: ${syntaxColors['--syntax-type']}; }
                .token-variable { color: ${syntaxColors['--syntax-variable']}; }
                .token-operator { color: ${syntaxColors['--syntax-operator']}; }
                .token-punctuation { color: ${syntaxColors['--syntax-punctuation']}; }
            `;
            
            const patternsObjectString = serializePatternsForIframe(customSyntaxHighlighter.patterns);

            const iframeContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        /* Scoped styles for the iframe content */
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: transparent;
                            margin: 0;
                            padding: 8px;
                            line-height: 1.6;
                            overflow-wrap: break-word;
                        }
                        ${nodeData.properties ? this.generateScopedStyles(nodeData.properties) : ''}
                        ${nodeData.codeBlockProperties ? this.generateCodeBlockStyles(nodeData.codeBlockProperties, syntaxColors) : ''}
                        ${syntaxHighlightingStyles}
                        .mermaid { text-align: center; }
                    </style>
                </head>
                <body>
                    ${parsedContent}
                    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></scr` + `ipt>
                    <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.3/build/opensheetmusicdisplay.min.js"></scr` + `ipt>
                    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></scr` + `ipt>
                    <script>
                        const highlighter = {
                            patterns: ${patternsObjectString},
                            highlight: ${customSyntaxHighlighter.highlight.toString()},
                            tokenizeAndHighlight: ${customSyntaxHighlighter.tokenizeAndHighlight.toString()}
                        };

                        document.addEventListener('DOMContentLoaded', () => {
                            document.querySelectorAll('pre[data-lang]').forEach(pre => {
                                const code = pre.querySelector('code');
                                if (code) {
                                    const lang = pre.dataset.lang;
                                    code.innerHTML = highlighter.highlight(code.textContent, lang);
                                }
                            });

                            mermaid.initialize({ startOnLoad: false, theme: '${mermaidTheme}' });
                            async function renderAll() {
                                const musicXmlPlaceholders = document.querySelectorAll('.musicxml-placeholder');
                                for (const el of musicXmlPlaceholders) {
                                    const code = decodeURIComponent(el.dataset.musicxml);
                                    const renderDiv = document.createElement('div');
                                    el.replaceWith(renderDiv);
                                    try {
                                        const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(renderDiv, { autoResize: true, backend: "svg", drawTitle: true });
                                        await osmd.load(code);
                                        osmd.render();
                                    } catch (e) {
                                        renderDiv.innerHTML = \`<div style="color: red;">MusicXML Error: \${e.message}</div>\`;
                                    }
                                }
                                await mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
                                if (window.MathJax && window.MathJax.typesetPromise) await window.MathJax.typesetPromise();
                            }
                            renderAll();
                        });
                    </scr` + `ipt>
                </body>
                </html>
            `;
            iframe.srcdoc = iframeContent;
        } else {
            previewButton.textContent = 'Preview';
            iframe.srcdoc = '';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
            
    setupNodeEvents(node) {
        const header = node.querySelector('.node-header');
        
        header.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.draggedNode = node;
            
            if (!this.selectedNodes.has(node.id)) {
                if (!e.ctrlKey) {
                    this.deselectAll();
                }
                this.selectNode(node, e.ctrlKey);
            }

            this.draggedNodesInitialPositions.clear();
            this.selectedNodes.forEach(nodeId => {
                const nodeData = this.nodes.get(nodeId);
                if (nodeData) {
                    this.draggedNodesInitialPositions.set(nodeId, {
                        x: nodeData.element.offsetLeft,
                        y: nodeData.element.offsetTop
                    });
                }
            });

            const canvasRect = this.canvas.getBoundingClientRect();
            this.dragOffset.x = (e.clientX - canvasRect.left) - this.canvasOffset.x - (node.offsetLeft * this.scale);
            this.dragOffset.y = (e.clientY - canvasRect.top) - this.canvasOffset.y - (node.offsetTop * this.scale);
        });

        node.querySelectorAll('.socket').forEach(socket => {
            socket.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startConnection(socket, e); });
            socket.addEventListener('mouseup', (e) => { e.stopPropagation(); this.completeConnection(socket); });
        });

        const contentElements = node.querySelectorAll('textarea, input[data-param], input[type="checkbox"], select[data-param]');
        contentElements.forEach(input => {
            let debounceTimer;
            const recordChange = () => {
                this.processNodeData(node.id);
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                   this.recordState("Edit Content");
                }, 500);
            };
            input.addEventListener('input', recordChange);
            input.addEventListener('change', recordChange);
        });

        node.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            this.selectNode(node, e.ctrlKey);
        });
        
        // Event listeners for social share buttons
        node.querySelectorAll('[data-share]').forEach(button => {
            button.addEventListener('click', () => {
                const platform = button.dataset.share;
                this.processSocialShareNode(this.nodes.get(node.id), platform);
            });
        });

        this.setupResize(node);
    }

    setupResize(node) {
        const resizeHandle = node.querySelector('.resize-handle');
        if (!resizeHandle) return;
        let startX, startY, startWidth, startHeight;

        const onMouseMove = (e) => {
            const newWidth = Math.max(200, startWidth + (e.clientX - startX) / this.scale);
            const newHeight = Math.max(100, startHeight + (e.clientY - startY) / this.scale);
            node.style.width = newWidth + 'px';
            node.style.height = newHeight + 'px';
            this.updateConnections();
            
            const nodeData = this.nodes.get(node.id);
            if (nodeData && nodeData.isContainer) {
                this.updateLayout(node.id);
            }
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.recordState("Resize Node");
        };

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            startX = e.clientX; startY = e.clientY;
            startWidth = node.offsetWidth; startHeight = node.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    startConnection(socket, event) {
        if (socket.classList.contains('output')) {
            this.connectionStart = { node: socket.closest('.node').id, socket: socket.dataset.socket };
            this.tempConnection = document.createElementNS(this.SVG_NS, 'path');
            this.tempConnection.setAttribute('d', '');
            this.tempConnection.classList.add('temp-connection-path');
            this.connectionsContainer.appendChild(this.tempConnection);
            this.updateTempConnection(event);
        }
    }

    updateTempConnection(event) {
        if (!this.tempConnection || !this.connectionStart) return;
        const fromNode = this.nodes.get(this.connectionStart.node);
        if (!fromNode) return;
        const fromSocket = fromNode.element.querySelector(`[data-socket="${this.connectionStart.socket}"]`);
        if (!fromSocket) return;

        const startPos = this.getSocketPositionInWorld(fromSocket);
        const canvasRect = this.canvas.getBoundingClientRect();
        const endX = (event.clientX - canvasRect.left - this.canvasOffset.x) / this.scale;
        const endY = (event.clientY - canvasRect.top - this.canvasOffset.y) / this.scale;

        const path = this.createBezierPath(startPos.x, startPos.y, endX, endY);
        this.tempConnection.setAttribute('d', path);
    }

    completeConnection(targetSocket) {
        if (!this.connectionStart || !targetSocket.classList.contains('input')) {
            return;
        }
        const targetNodeId = targetSocket.closest('.node').id;
        if (this.connectionStart.node === targetNodeId) {
            return;
        }
        const targetSocketName = targetSocket.dataset.socket;
        this.connections = this.connections.filter(c => !(c.to.node === targetNodeId && c.to.socket === targetSocketName));
        this.connections.push({ from: { node: this.connectionStart.node, socket: this.connectionStart.socket }, to: { node: targetNodeId, socket: targetSocketName } });
        
        this.recordState("Create Connection");
        this.updateConnections();
        this.updateSocketStates();
        this.processNodeData(targetNodeId);
        
        this.connectionStart = null; 
    }

    getSocketPositionInWorld(socketEl) {
        const nodeEl = socketEl.closest('.node');
        const nodeX = nodeEl.offsetLeft;
        const nodeY = nodeEl.offsetTop;
        const socketX = socketEl.offsetLeft + socketEl.offsetWidth / 2;
        const socketY = socketEl.offsetTop + socketEl.offsetHeight / 2;
        return {
            x: nodeX + socketX,
            y: nodeY + socketY
        };
    }

    updateSocketStates() {
        this.world.querySelectorAll('.socket').forEach(s => s.classList.remove('connected'));
        this.connections.forEach(c => {
            const fromNode = this.nodes.get(c.from.node);
            const toNode = this.nodes.get(c.to.node);
            if (fromNode && toNode) {
                const fromSocket = fromNode.element.querySelector(`[data-socket="${c.from.socket}"]`);
                const toSocket = toNode.element.querySelector(`[data-socket="${c.to.socket}"]`);
                if (fromSocket) fromSocket.classList.add('connected');
                if (toSocket) toSocket.classList.add('connected');
            }
        });
    }

    updateConnections() {
        this.connectionsContainer.innerHTML = ''; // Clear all but defs
        const defs = `<defs><linearGradient id="wireGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#5CAF60;stop-opacity:1" /><stop offset="50%" style="stop-color:#4CAF50;stop-opacity:1" /><stop offset="100%" style="stop-color:#3E9142;stop-opacity:1" /></linearGradient></defs>`;
        this.connectionsContainer.insertAdjacentHTML('afterbegin', defs);

        this.connections.forEach((conn, index) => {
            const fromNode = this.nodes.get(conn.from.node);
            const toNode = this.nodes.get(conn.to.node);
            if (!fromNode || !toNode) return;

            const fromSocket = fromNode.element.querySelector(`[data-socket="${conn.from.socket}"]`);
            const toSocket = toNode.element.querySelector(`[data-socket="${conn.to.socket}"]`);
            if (!fromSocket || !toSocket) return;

            const startPos = this.getSocketPositionInWorld(fromSocket);
            const endPos = this.getSocketPositionInWorld(toSocket);

            const pathData = this.createBezierPath(startPos.x, startPos.y, endPos.x, endPos.y);
            const wireGroup = document.createElementNS(this.SVG_NS, 'g');
            wireGroup.setAttribute('data-conn-index', index);
            wireGroup.setAttribute('title', 'Right-click to delete connection');

            const hitboxPath = document.createElementNS(this.SVG_NS, 'path');
            hitboxPath.setAttribute('d', pathData);
            hitboxPath.classList.add('connection-hitbox');

            const mainPath = document.createElementNS(this.SVG_NS, 'path');
            mainPath.setAttribute('d', pathData);
            mainPath.classList.add('connection-wire');
            
            wireGroup.append(hitboxPath, mainPath);
            this.connectionsContainer.appendChild(wireGroup);
        });
    }

    createBezierPath(x1, y1, x2, y2) { const c = Math.abs(x2 - x1) * 0.6; return `M ${x1} ${y1} C ${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`; }

    processNodeData(nodeId) {
        const nodeData = this.nodes.get(nodeId);
        if (!nodeData) return;

        const processor = this.nodeProcessors[nodeData.type];
        if (processor) {
            processor(nodeData);
        }

        this.connections.forEach(c => {
            if (c.from.node === nodeId) {
                this.processNodeData(c.to.node);
            }
        });
    }

    processTextNode(nodeData) {
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        if (inputConn) {
            const sourceNode = this.nodes.get(inputConn.from.node);
            const inputText = sourceNode.outputs[inputConn.from.socket] || '';
            textarea.value = inputText;
            nodeData.outputs.text_out = inputText;
        } else {
            nodeData.outputs.text_out = textarea.value;
        }
    }

    processFindReplaceNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const matchesDiv = nodeData.element.querySelector('[data-matches]');
        const inputConnection = this.connections.find(conn => conn.to.node === nodeData.element.id && conn.to.socket === 'input_text');

        if (!inputConnection) {
            statusDiv.textContent = 'No input connected';
            matchesDiv.innerHTML = '<em>No input connected</em>';
            nodeData.outputs.output_text = '';
        } else {
            const sourceNodeData = this.nodes.get(inputConnection.from.node);
            const inputText = sourceNodeData.outputs[inputConnection.from.socket] || '';
            const findText = nodeData.element.querySelector('input[data-param="find"]').value;
            const replaceText = nodeData.element.querySelector('input[data-param="replace"]').value;
            
            let outputText = inputText;
            
            if (findText) {
                try {
                    const isRegex = nodeData.element.querySelector('input[data-param="regex"]').checked;
                    const isGlobal = nodeData.element.querySelector('input[data-param="global"]').checked;
                    const isCaseSensitive = nodeData.element.querySelector('input[data-param="case_sensitive"]').checked;
                    let flags = isGlobal ? 'g' : '';
                    if (!isCaseSensitive) flags += 'i';

                    const searchPattern = isRegex ? new RegExp(findText, flags) : new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                    
                    const matches = [...inputText.matchAll(new RegExp(searchPattern.source, searchPattern.flags.replace('g','') + 'g'))];
                    const matchCount = matches.length;
                    
                    outputText = inputText.replace(searchPattern, replaceText);
                    
                    if (matchCount > 0) {
                        statusDiv.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'} found.`;
                        statusDiv.style.color = 'var(--socket-text)';
                        matchesDiv.innerHTML = matches.slice(0, 10).map((match, i) => `<div class="match-item">Match ${i + 1}: "${match[0]}"</div>`).join('');
                    } else {
                        statusDiv.textContent = 'No matches found';
                        statusDiv.style.color = '#ff9800';
                        matchesDiv.innerHTML = '<em>No matches found</em>';
                    }
                } catch (error) {
                    statusDiv.textContent = `Regex error: ${error.message}`;
                    statusDiv.style.color = '#f44336';
                    matchesDiv.innerHTML = `<em style="color: #f44336;">${error.message}</em>`;
                }
            } else {
                statusDiv.textContent = 'Enter find pattern';
                matchesDiv.innerHTML = '<em>Enter find pattern</em>';
            }
            nodeData.outputs.output_text = outputText;
        }
    }

    processImportNode(nodeData) {
        const textarea = nodeData.element.querySelector('textarea');
        nodeData.outputs.data_out = textarea.value;
    }

    processExportNode(nodeData) {
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');
        if (inputConn) {
            const sourceNode = this.nodes.get(inputConn.from.node);
            const inputData = sourceNode.outputs[inputConn.from.socket];
            if (typeof inputData === 'object') {
                textarea.value = JSON.stringify(inputData, null, 2);
            } else {
                textarea.value = inputData || '';
            }
        } else {
            textarea.value = 'No input connected.';
        }
    }

    processCsvNode(nodeData) {
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'csv_in');
        if (inputConn) {
            const sourceNode = this.nodes.get(inputConn.from.node);
            const csvText = sourceNode.outputs[inputConn.from.socket] || '';
            const lines = csvText.trim().split('\n');
            if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.trim());
                nodeData.outputs.data_out = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    let row = {};
                    headers.forEach((header, i) => {
                        row[header] = values[i];
                    });
                    return row;
                });
            } else {
                nodeData.outputs.data_out = [];
            }
        } else {
            nodeData.outputs.data_out = [];
        }
    }

    processJsonNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const operation = nodeData.element.querySelector('select[data-param="operation"]').value;
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');
        
        if (!inputConn) {
            statusDiv.textContent = 'No input connected.';
            nodeData.outputs.data_out = operation === 'parse' ? {} : '';
            return;
        }

        const sourceNode = this.nodes.get(inputConn.from.node);
        const inputData = sourceNode.outputs[inputConn.from.socket];

        try {
            if (operation === 'parse') {
                nodeData.outputs.data_out = JSON.parse(inputData);
            } else { // stringify
                nodeData.outputs.data_out = JSON.stringify(inputData, null, 2);
            }
            statusDiv.textContent = 'Success';
            statusDiv.style.color = 'var(--socket-text)';
        } catch (e) {
            nodeData.outputs.data_out = operation === 'parse' ? {} : '';
            statusDiv.textContent = `Error: ${e.message}`;
            statusDiv.style.color = '#f44336';
        }
    }
    
    processXmlNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        statusDiv.textContent = 'XML processing is not yet implemented.';
        nodeData.outputs.data_out = {}; // Placeholder
    }
    
    processSplitNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        statusDiv.textContent = 'Split logic is not yet implemented.';
        nodeData.outputs.data_out_1 = []; // Placeholder
        nodeData.outputs.data_out_2 = []; // Placeholder
    }

    processFilterNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');
        if (inputConn) {
            const sourceNode = this.nodes.get(inputConn.from.node);
            const inputData = sourceNode.outputs[inputConn.from.socket];
            const condition = nodeData.element.querySelector('textarea[data-param="condition"]').value;

            if (!Array.isArray(inputData)) {
                nodeData.outputs.data_out = [];
                statusDiv.textContent = 'Error: Input is not an array.';
                return;
            }

            if (!condition) {
                nodeData.outputs.data_out = inputData;
                statusDiv.textContent = '';
                return;
            }

            try {
                const filterFunc = new Function('row', `return ${condition}`);
                nodeData.outputs.data_out = inputData.filter(filterFunc);
                statusDiv.textContent = `Filtered ${inputData.length} rows to ${nodeData.outputs.data_out.length}.`;
                statusDiv.style.color = 'var(--text-secondary)';
            } catch (e) {
                nodeData.outputs.data_out = [];
                statusDiv.textContent = `Error: ${e.message}`;
                statusDiv.style.color = '#f44336';
            }
        } else {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'No input connected.';
        }
    }

    processTransformNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');
        if (inputConn) {
            const sourceNode = this.nodes.get(inputConn.from.node);
            const inputData = sourceNode.outputs[inputConn.from.socket];
            const logic = nodeData.element.querySelector('textarea[data-param="logic"]').value;

            if (!Array.isArray(inputData)) {
                nodeData.outputs.data_out = [];
                statusDiv.textContent = 'Error: Input is not an array.';
                return;
            }

            try {
                const transformFunc = new Function('row', logic);
                nodeData.outputs.data_out = inputData.map(transformFunc);
                statusDiv.textContent = `Transformed ${inputData.length} rows.`;
                statusDiv.style.color = 'var(--text-secondary)';
            } catch (e) {
                nodeData.outputs.data_out = [];
                statusDiv.textContent = `Error: ${e.message}`;
                statusDiv.style.color = '#f44336';
            }
        } else {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'No input connected.';
        }
    }

    processMergeNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const key = nodeData.element.querySelector('input[data-param="key"]').value;
        const conn1 = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in_1');
        const conn2 = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in_2');

        if (!conn1 || !conn2) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'Both inputs must be connected.';
            return;
        }
        if (!key) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'Join key is required.';
            return;
        }
        
        const [leftKey, rightKey] = key.includes('=') ? key.split('=').map(k => k.trim()) : [key.trim(), key.trim()];

        const data1 = this.nodes.get(conn1.from.node).outputs[conn1.from.socket];
        const data2 = this.nodes.get(conn2.from.node).outputs[conn2.from.socket];

        if (!Array.isArray(data1) || !Array.isArray(data2)) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'Inputs must be arrays.';
            return;
        }

        const map2 = new Map(data2.map(item => [item[rightKey], item]));
        nodeData.outputs.data_out = data1.map(item1 => {
            const item2 = map2.get(item1[leftKey]);
            return item2 ? { ...item1, ...item2 } : item1;
        });
        statusDiv.textContent = `Merged ${data1.length} and ${data2.length} rows into ${nodeData.outputs.data_out.length}.`;
        statusDiv.style.color = 'var(--text-secondary)';
    }

    processAggregateNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const groupBy = nodeData.element.querySelector('input[data-param="groupBy"]').value;
        const aggFunc = nodeData.element.querySelector('select[data-param="aggFunc"]').value;
        const aggKey = nodeData.element.querySelector('input[data-param="aggKey"]').value;
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');
        
        if (!inputConn) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'No input connected.';
            return;
        }
        if (!groupBy || !aggKey) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'Group By and Of Key are required.';
            return;
        }

        const inputData = this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket];
        if (!Array.isArray(inputData)) {
            nodeData.outputs.data_out = [];
            statusDiv.textContent = 'Input must be an array.';
            return;
        }

        const groups = inputData.reduce((acc, row) => {
            const key = row[groupBy];
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(row);
            return acc;
        }, {});

        const result = Object.keys(groups).map(key => {
            const rows = groups[key];
            let value;
            switch (aggFunc) {
                case 'count':
                    value = rows.length;
                    break;
                case 'sum':
                    value = rows.reduce((sum, row) => sum + (parseFloat(row[aggKey]) || 0), 0);
                    break;
                case 'avg':
                    const sum = rows.reduce((s, r) => s + (parseFloat(r[aggKey]) || 0), 0);
                    value = rows.length > 0 ? sum / rows.length : 0;
                    break;
            }
            return { [groupBy]: key, [`${aggFunc}_of_${aggKey}`]: value };
        });

        nodeData.outputs.data_out = result;
        statusDiv.textContent = `Aggregated ${inputData.length} rows into ${result.length} groups.`;
        statusDiv.style.color = 'var(--text-secondary)';
    }
    
    async processSpellCheckNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        
        statusDiv.textContent = 'Loading dictionary...';
        if (!this.typoLoaded && !this.typoLoading) {
            this.typoLoading = true;
            try {
                const [aff, dic] = await Promise.all([
                    fetch('https://unpkg.com/typo-js@1.2.0/dictionaries/en_US/en_US.aff').then(res => res.text()),
                    fetch('https://unpkg.com/typo-js@1.2.0/dictionaries/en_US/en_US.dic').then(res => res.text())
                ]);
                this.typo = new Typo("en_US", aff, dic);
                this.typoLoaded = true;
                statusDiv.textContent = 'Dictionary loaded. Spell checking...';
            } catch (e) {
                statusDiv.textContent = `Error loading dictionary: ${e.message}`;
                console.error(e);
                return;
            } finally {
                this.typoLoading = false;
            }
        } else if (!this.typoLoaded) {
            statusDiv.textContent = 'Dictionary is still loading...';
            return;
        }

        const words = inputText.split(/\s+/);
        const correctedWords = words.map(word => {
            if (this.typo.check(word)) {
                return word;
            } else {
                const suggestions = this.typo.suggest(word);
                return suggestions.length > 0 ? suggestions[0] : word;
            }
        });

        const correctedText = correctedWords.join(' ');
        textarea.value = correctedText;
        nodeData.outputs.text_out = correctedText;
        statusDiv.textContent = 'Spell check complete.';
    }

    processTranslationNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        const targetLang = nodeData.element.querySelector('select[data-param="targetLang"]').value;

        // Simple hard-coded translation logic for demonstration
        // A real implementation would require a backend API call to a service like LibreTranslate
        const translations = {
            "es": { "hello": "hola", "world": "mundo", "is": "es", "this": "esto", "a": "un", "test": "prueba" },
            "fr": { "hello": "bonjour", "world": "monde", "is": "est", "this": "ceci", "a": "un", "test": "test" },
            "de": { "hello": "hallo", "world": "welt", "is": "ist", "this": "dies", "a": "ein", "test": "test" },
            "ja": { "hello": "こんにちは", "world": "世界", "is": "です", "this": "これ", "a": "", "test": "テスト" }
        };

        const translationMap = translations[targetLang] || {};
        const translatedText = inputText.toLowerCase().split(/\b/).map(word => {
            return translationMap[word] || word;
        }).join('');

        textarea.value = translatedText;
        nodeData.outputs.text_out = translatedText;
        statusDiv.textContent = `Translated to ${targetLang}. Note: This is a placeholder for real API functionality.`;
    }

    processSummarizationNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        
        let summary = inputText.split('.').slice(0, 2).join('. ') + '.'; // Naive summary
        
        textarea.value = summary;
        nodeData.outputs.text_out = summary;
        statusDiv.textContent = 'Summarization is a complex NLP task. This is a naive implementation.';
    }

    processSentimentAnalysisNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const scoreInput = nodeData.element.querySelector('input[data-output="sentimentScore"]');
        const labelInput = nodeData.element.querySelector('input[data-output="sentimentLabel"]');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        
        let sentimentScore = 0.5;
        let sentimentLabel = 'Neutral';

        if (inputText.toLowerCase().includes('great') || inputText.toLowerCase().includes('happy')) {
            sentimentScore = 0.9;
            sentimentLabel = 'Positive';
        } else if (inputText.toLowerCase().includes('bad') || inputText.toLowerCase().includes('sad')) {
            sentimentScore = 0.1;
            sentimentLabel = 'Negative';
        }
        
        scoreInput.value = sentimentScore.toFixed(2);
        labelInput.value = sentimentLabel;
        nodeData.outputs.sentiment = { score: sentimentScore, label: sentimentLabel };
        statusDiv.textContent = 'Sentiment analysis is a complex task. This is a basic keyword search placeholder.';
    }

    processAutoFormatNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const textarea = nodeData.element.querySelector('textarea');
        const formatType = nodeData.element.querySelector('select[data-param="formatType"]').value;
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';

        try {
            let formattedText = inputText;
            switch (formatType) {
                case 'js':
                    formattedText = js_beautify.js_beautify(inputText, { indent_size: 2, space_in_empty_paren: true });
                    break;
                case 'html':
                    formattedText = html_beautify(inputText, { indent_size: 2 });
                    break;
                case 'css':
                    formattedText = css_beautify(inputText, { indent_size: 2 });
                    break;
                case 'json':
                    formattedText = JSON.stringify(JSON.parse(inputText), null, 2);
                    break;
            }
            textarea.value = formattedText;
            nodeData.outputs.text_out = formattedText;
            statusDiv.textContent = `Formatted as ${formatType.toUpperCase()}.`;
        } catch (e) {
            statusDiv.textContent = `Formatting Error: ${e.message}`;
        }
    }

    processTemplateNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const templateInput = nodeData.element.querySelector('textarea[data-param="template"]');
        const variablesInput = nodeData.element.querySelector('textarea[data-param="variables"]');
        const templateConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'template_in');
        const dataConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'data_in');

        const template = templateConn ? this.nodes.get(templateConn.from.node).outputs[templateConn.from.socket] : templateInput.value;
        const rawData = dataConn ? this.nodes.get(dataConn.from.node).outputs[dataConn.from.socket] : variablesInput.value;
        
        let variables = {};
        if (typeof rawData === 'string') {
            try {
                variables = JSON.parse(rawData);
            } catch(e) {
                statusDiv.textContent = `Error parsing JSON data: ${e.message}`;
                nodeData.outputs.text_out = '';
                return;
            }
        } else if (typeof rawData === 'object') {
            variables = rawData;
        }

        let outputText = template;
        for (const key in variables) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            outputText = outputText.replace(regex, variables[key]);
        }
        
        nodeData.outputs.text_out = outputText;
        statusDiv.textContent = 'Template processed.';
    }

    processMacroNode(nodeData) {
       const statusDiv = nodeData.element.querySelector('.node-status');
       statusDiv.textContent = 'Macro Node is a placeholder.';
    }

    async processOcrNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const textarea = nodeData.element.querySelector('textarea');
        const input = document.getElementById('ocr-file-input');
        
        if (input.files.length === 0) {
            statusDiv.textContent = 'Please select an image file to process.';
            return;
        }

        const file = input.files[0];
        const img = nodeData.element.querySelector('img');
        img.style.display = 'block';
        img.src = URL.createObjectURL(file);
        
        statusDiv.textContent = 'Loading OCR worker...';

        if (!this.tesseractLoaded && !this.tesseractLoading) {
            this.tesseractLoading = true;
            this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        statusDiv.textContent = `Processing: ${Math.floor(m.progress * 100)}%`;
                    } else {
                        statusDiv.textContent = m.status;
                    }
                }
            });
            this.tesseractLoaded = true;
        }
        
        if (!this.tesseractWorker) {
            statusDiv.textContent = 'Error: Tesseract worker failed to load.';
            return;
        }

        statusDiv.textContent = 'Recognizing text...';
        const { data: { text } } = await this.tesseractWorker.recognize(file);
        textarea.value = text;
        nodeData.outputs.text_out = text;
        statusDiv.textContent = 'OCR complete!';
        input.value = ''; // Reset input
    }

    processTtsNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        const rate = parseFloat(nodeData.element.querySelector('input[data-param="rate"]').value);
        const pitch = parseFloat(nodeData.element.querySelector('input[data-param="pitch"]').value);

        if (!inputText) {
            statusDiv.textContent = 'No text to speak.';
            return;
        }

        this.speech.text = inputText;
        this.speech.rate = rate;
        this.speech.pitch = pitch;

        const selectedVoice = nodeData.element.querySelector('input[data-param="voice"]').value;
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === selectedVoice) || voices.find(v => v.lang.startsWith('en')) || null;
        if (voice) {
            this.speech.voice = voice;
            statusDiv.textContent = `Speaking with voice: ${voice.name}`;
        } else {
            statusDiv.textContent = 'Speaking with default voice. Voice not found.';
        }

        window.speechSynthesis.speak(this.speech);
    }
    
    processEmailNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const bodyText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        const to = nodeData.element.querySelector('input[data-param="to"]').value;
        const subject = nodeData.element.querySelector('input[data-param="subject"]').value;
        
        if (!to) {
            statusDiv.textContent = 'Recipient email address is required.';
            return;
        }

        const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
        
        // Using a temporary iframe to avoid page navigation issues in some environments.
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = mailtoLink;
        document.body.appendChild(iframe);
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 100);

        statusDiv.textContent = 'Opening email client...';
    }

    async processPdfNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        
        if (!inputConn) {
            statusDiv.textContent = 'No input connected.';
            return;
        }

        const sourceNode = this.nodes.get(inputConn.from.node);
        const textContent = sourceNode ? sourceNode.outputs[inputConn.from.socket] : '';

        if (!textContent) {
            statusDiv.textContent = 'Input is empty.';
            return;
        }

        statusDiv.textContent = 'Generating PDF...';

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Assume input is Markdown/HTML. Parse it.
            const parsedHtml = DOMPurify.sanitize(marked.parse(textContent));

            // Create a temporary element to render the HTML for pdf generation
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px'; // Position off-screen
            tempContainer.style.width = '700px'; // A reasonable width for PDF content
            tempContainer.innerHTML = parsedHtml;
            document.body.appendChild(tempContainer);

            await doc.html(tempContainer, {
                callback: function(doc) {
                    doc.save('document.pdf');
                    statusDiv.textContent = 'PDF generated!';
                    document.body.removeChild(tempContainer); // Clean up the temporary element
                },
                x: 10,
                y: 10,
                width: 190, // A4 width in mm is 210, leaving margins
                windowWidth: 700 // The width of the temp container
            });

        } catch (e) {
            statusDiv.textContent = `Error creating PDF: ${e.message}`;
            console.error(e);
        }
    }

    processHtmlRenderNode(nodeData) {
        const textarea = nodeData.element.querySelector('textarea');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';
        
        textarea.value = inputText;
        nodeData.outputs.text_out = inputText;
    }

    processQrCodeNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const qrContainer = nodeData.element.querySelector('[data-qr-container]');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const inputText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';

        qrContainer.innerHTML = '';
        if (inputText) {
            new QRCode(qrContainer, {
                text: inputText,
                width: 128,
                height: 128,
            });
            statusDiv.textContent = 'QR Code generated.';
        } else {
            statusDiv.textContent = 'No input to generate QR code.';
        }
    }

    processSocialShareNode(nodeData, platform) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const shareText = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';

        if (!shareText) {
            statusDiv.textContent = 'No text to share.';
            return;
        }

        let shareUrl = '';
        const encodedText = encodeURIComponent(shareText);

        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedText}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedText}`;
                break;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
            statusDiv.textContent = `Sharing on ${platform}...`;
        }
    }

    async processScreenshotNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        statusDiv.textContent = 'Taking screenshot...';
        try {
            const canvas = await html2canvas(this.world);
            const imageURL = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = imageURL;
            a.download = `screenshot-${Date.now()}.png`;
            a.click();
            statusDiv.textContent = 'Screenshot saved!';
        } catch (e) {
            statusDiv.textContent = `Error: ${e.message}`;
        }
    }

    processPrintNode(nodeData) {
        const statusDiv = nodeData.element.querySelector('.node-status');
        const inputConn = this.connections.find(c => c.to.node === nodeData.element.id && c.to.socket === 'text_in');
        const textContent = inputConn ? this.nodes.get(inputConn.from.node).outputs[inputConn.from.socket] : '';

        if (!textContent) {
            statusDiv.textContent = 'No content to print.';
            return;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Print</title></head><body>');
        printWindow.document.write('<pre>' + textContent + '</pre>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
        statusDiv.textContent = 'Print dialog opened.';
    }

    selectNode(node, isCtrlPressed = false) {
        if (!isCtrlPressed) {
            this.deselectAll();
            node.classList.add('selected');
            this.selectedNodes.add(node.id);
        } else {
            if (this.selectedNodes.has(node.id)) {
                node.classList.remove('selected');
                this.selectedNodes.delete(node.id);
            } else {
                node.classList.add('selected');
                this.selectedNodes.add(node.id);
            }
        }
        
        if (this.selectedNodes.size === 1) {
            this.analyzeContentAndRepopulateSidebar(this.selectedNodes.values().next().value);
            this.sidebar.classList.remove('collapsed');
            this.sidebarToggle.innerHTML = '&laquo;';
        } else {
            this.populateSidebarForMultiSelect();
        }
    }

    deselectAll() {
        this.selectedNodes.forEach(nodeId => {
            const nodeData = this.nodes.get(nodeId);
            if (nodeData) {
                nodeData.element.classList.remove('selected');
            }
        });
        this.selectedNodes.clear();
        if (!this.sidebar.classList.contains('collapsed')) {
            this.sidebar.classList.add('collapsed');
            this.sidebarToggle.innerHTML = '&raquo;';
        }
    }

    analyzeContentAndRepopulateSidebar(nodeId) {
        const nodeData = this.nodes.get(nodeId);
        if (!nodeData) return;
        
        let detectedElements = [];
        if (nodeData.type === 'text') {
            const content = nodeData.element.querySelector('textarea').value;
            const elementSet = new Set();
            
            if (/^#{1,6}\s/m.test(content)) {
                for(let i=1; i<=6; i++) if (new RegExp(`^#{${i}}\\s`, 'm').test(content)) elementSet.add(`h${i}`);
            }
            if (/\*\*(.*?)\*\*|__(.*?)__/g.test(content)) elementSet.add('strong');
            if (/\*(.*?)\*|_(.*?)_/g.test(content)) elementSet.add('em');
            if (/^>\s/m.test(content)) elementSet.add('blockquote');
            if (/\[(.*?)\]\((.*?)\)/g.test(content)) elementSet.add('a');
            if (/`(.+?)`/g.test(content)) elementSet.add('code');
            if (/```(.*?)```/gs.test(content)) elementSet.add('pre');
            if (/^---\s*$/m.test(content)) elementSet.add('hr');
            if (/^[\*\-]\s/m.test(content)) { elementSet.add('ul'); elementSet.add('li'); }
            if (/^\d+\.\s/m.test(content)) { elementSet.add('ol'); elementSet.add('li'); }
            if (/\|.*\|/m.test(content)) { elementSet.add('table'); elementSet.add('th'); }

            detectedElements = Array.from(elementSet);
        }
        this.populateSidebar(nodeData.element, detectedElements);
    }
    
    populateSidebarForMultiSelect() {
        this.sidebar.querySelector('.sidebar-main-title').textContent = 'Properties';
        this.sidebarContent.innerHTML = `<div class="sidebar-section"><div class="sidebar-title">${this.selectedNodes.size} Nodes Selected</div></div>`;
        this.sidebar.classList.remove('collapsed');
        this.sidebarToggle.innerHTML = '&laquo;';
    }

    populateSidebar(node, detectedElements = []) {
        const nodeData = this.nodes.get(node.id);
        this.sidebarContent.innerHTML = '';
        this.sidebar.querySelector('.sidebar-main-title').textContent = 'Properties';

        if (nodeData.type === 'text') {
            const generalSection = document.createElement('div');
            generalSection.className = 'sidebar-section';
            generalSection.innerHTML = `<div class="sidebar-title">Text Properties</div>`;
            this.createPropItem(generalSection, 'font-size', 'Font Size (px)', 'number', nodeData.properties.fontSize, (e) => this.updateNodeStyle(node.id, 'properties.fontSize', e.target.value));
            this.createPropItem(generalSection, 'font-color', 'Color', 'color', nodeData.properties.color, (e) => this.updateNodeStyle(node.id, 'properties.color', e.target.value));
            this.sidebarContent.appendChild(generalSection);
            
            if (detectedElements.length > 0) {
                const mdSection = document.createElement('div');
                mdSection.className = 'sidebar-section';
                mdSection.innerHTML = `<div class="sidebar-title">Markdown Styles</div>`;
                
                detectedElements.sort().forEach(el => {
                    if(el.startsWith('h')) {
                        this.createPropItem(mdSection, `${el}-color`, `${el.toUpperCase()} Color`, 'color', nodeData.properties[el].color, (e) => this.updateNodeStyle(node.id, `properties.${el}.color`, e.target.value));
                        this.createPropItem(mdSection, `${el}-size`, `${el.toUpperCase()} Size (px)`, 'number', nodeData.properties[el].fontSize, (e) => this.updateNodeStyle(node.id, `properties.${el}.fontSize`, e.target.value));
                    } else if (nodeData.properties[el] && !['pre', 'code'].includes(el)) {
                        const label = el.charAt(0).toUpperCase() + el.slice(1);
                        if (nodeData.properties[el].color !== undefined) {
                            this.createPropItem(mdSection, `${el}-color`, `${label} Color`, 'color', nodeData.properties[el].color, (e) => this.updateNodeStyle(node.id, `properties.${el}.color`, e.target.value));
                        }
                        if (nodeData.properties[el].backgroundColor !== undefined) {
                            this.createPropItem(mdSection, `${el}-bgcolor`, `${label} BG Color`, 'color', nodeData.properties[el].backgroundColor, (e) => this.updateNodeStyle(node.id, `properties.${el}.backgroundColor`, e.target.value));
                        }
                        if (nodeData.properties[el].borderColor !== undefined) {
                            this.createPropItem(mdSection, `${el}-bordercolor`, `${label} Border`, 'color', nodeData.properties[el].borderColor, (e) => this.updateNodeStyle(node.id, `properties.${el}.borderColor`, e.target.value));
                        }
                    }
                });
                
                if (mdSection.childElementCount > 1) {
                   this.sidebarContent.appendChild(mdSection);
                }
            }

            if (detectedElements.includes('pre')) {
                const codeSection = document.createElement('div');
                codeSection.className = 'sidebar-section';
                codeSection.innerHTML = `<div class="sidebar-title">Code Block Styles</div>`;
                this.createPropItem(codeSection, 'pre-font-size', 'Font Size (px)', 'number', nodeData.codeBlockProperties.fontSize, (e) => this.updateNodeStyle(node.id, 'codeBlockProperties.fontSize', e.target.value));
                this.createPropSelect(codeSection, 'pre-syntax-theme', 'Syntax Theme', ['dark', 'light'], nodeData.codeBlockProperties.syntaxTheme, (e) => this.updateNodeStyle(node.id, 'codeBlockProperties.syntaxTheme', e.target.value));
                this.sidebarContent.appendChild(codeSection);
            }
        }
    }
    
    createPropItem(parent, id, label, type, value, listener) {
        const item = document.createElement('div');
        item.className = 'prop-item';
        item.innerHTML = `<label for="${id}">${label}</label>`;
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.value = value;
        input.addEventListener('input', listener);
        item.appendChild(input);
        parent.appendChild(item);
    }
    
    createPropSelect(parent, id, label, options, value, listener) {
        const item = document.createElement('div');
        item.className = 'prop-item';
        item.innerHTML = `<label for="${id}">${label}</label>`;
        const select = document.createElement('select');
        select.id = id;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            if (opt === value) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('change', listener);
        item.appendChild(select);
        parent.appendChild(item);
    }

    updateNodeStyle(nodeId, propertyPath, value) {
        const nodeData = this.nodes.get(nodeId);
        if (!nodeData) return;

        const keys = propertyPath.split('.');
        let current = nodeData;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        
        if (nodeData.element.classList.contains('preview-mode')) {
            this.togglePreview(nodeId).then(() => this.togglePreview(nodeId));
        }
        this.recordState("Update Style");
    }
    
    generateScopedStyles(props) {
        if (!props) return '';
        return `
            body { font-size: ${props.fontSize}px; color: ${props.color}; }
            h1 { color: ${props.h1.color}; font-size: ${props.h1.fontSize}px; }
            h2 { color: ${props.h2.color}; font-size: ${props.h2.fontSize}px; }
            h3 { color: ${props.h3.color}; font-size: ${props.h3.fontSize}px; }
            h4 { color: ${props.h4.color}; font-size: ${props.h4.fontSize}px; }
            h5 { color: ${props.h5.color}; font-size: ${props.h5.fontSize}px; }
            h6 { color: ${props.h6.color}; font-size: ${props.h6.fontSize}px; }
            strong { color: ${props.strong.color}; }
            em { color: ${props.em.color}; }
            blockquote { color: ${props.blockquote.color}; border-left: 4px solid ${props.blockquote.borderColor}; padding-left: 1em; margin-left: 0; }
            a { color: ${props.a.color}; }
            :not(pre) > code { color: ${props.code.color}; background-color: ${props.code.backgroundColor}; padding: .2em .4em; margin: 0; font-size: 85%; border-radius: 6px; }
            hr { border-color: ${props.hr.color}; border-top-width: 2px; }
            ul, ol { color: ${props.ul.color}; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid ${props.table.borderColor}; padding: 6px 13px; }
            th { background-color: ${props.th.backgroundColor}; }
        `;
    }
    
    generateCodeBlockStyles(props, syntaxColors) {
        if (!props || !syntaxColors) return '';
        return `
            pre[class*="language-"] {
                background: ${syntaxColors['--syntax-background']};
                border-radius: 0.3em;
                padding: 1em;
                margin: .5em 0;
                overflow: auto;
                font-family: 'Consolas', 'Monaco', monospace;
            }
            pre[class*="language-"] > code {
                font-size: ${props.fontSize}px;
                text-shadow: none;
                background: none;
                color: inherit;
                padding: 0;
            }
        `;
    }

    loadShowcase(jsonString) {
        this.clearCanvas();
        this.deserialize(jsonString);
        this.recordState("Load Showcase");
    }

    addShowcaseNode() { 
        this.clearCanvas();
        const showcaseContent = `
# Rendering Showcase

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
\`\`\`
`;

        const showcaseNode = this.createNode('text', 50, 50, { text: showcaseContent });
        showcaseNode.style.width = '600px';
        showcaseNode.style.height = '700px';
    }

    addTextNode() {
        this.createNode('text', 100, 100, { text: '# New Text Node' });
    }

    addFindReplaceNode() {
        this.createNode('find_replace', 100, 100);
    }

    showAddNodeSidebar() {
        this.deselectAll();
        this.sidebar.classList.remove('collapsed');
        this.sidebarToggle.innerHTML = '&laquo;';
        this.populateSidebarForAddNode();
    }

    populateSidebarForAddNode() {
        const sidebarTitle = this.sidebar.querySelector('.sidebar-main-title');
        sidebarTitle.textContent = 'Add Node';
        this.sidebarContent.innerHTML = '';

        const nodeCategories = {
            'General': [
                { name: 'Text Node', type: 'text' },
                { name: 'Find & Replace', type: 'find_replace' }
            ],
            'Data Processing': [
                { name: 'Import', type: 'import' },
                { name: 'Export', type: 'export' },
                { name: 'CSV', type: 'csv' },
                { name: 'JSON', type: 'json' },
                { name: 'XML', type: 'xml' },
                { name: 'Filter', type: 'filter' },
                { name: 'Transform', type: 'transform' },
                { name: 'Merge', type: 'merge' },
                { name: 'Split', type: 'split' },
                { name: 'Aggregate', type: 'aggregate' }
            ],
            'Automation': [
                { name: 'Spell Check', type: 'spell_check' },
                { name: 'Translation', type: 'translation' },
                { name: 'Summarization', type: 'summarization' },
                { name: 'Sentiment Analysis', type: 'sentiment_analysis' },
                { name: 'Auto-Format', type: 'auto_format' },
                { name: 'Template', type: 'template' },
                { name: 'Macro', type: 'macro' },
                { name: 'OCR', type: 'ocr' },
                { name: 'TTS', type: 'tts' }
            ],
            'Publishing': [
                { name: 'Email', type: 'email' },
                { name: 'PDF Render', type: 'pdf' },
                { name: 'HTML Render', type: 'html_render' },
                { name: 'QR Code', type: 'qr_code' },
                { name: 'Social Share', type: 'social_share' },
                { name: 'Screenshot', type: 'screenshot' },
                { name: 'Print', type: 'print' },
            ],
            'Layout & Structure': [
                { name: 'Container', type: 'container' },
                { name: 'Column', type: 'column' },
                { name: 'Grid', type: 'grid' },
                { name: 'Flex', type: 'flex' },
                { name: 'Tabs', type: 'tabs' },
                { name: 'Accordion', type: 'accordion' },
                { name: 'Card', type: 'card' },
                { name: 'Sidebar', type: 'sidebar' },
                { name: 'Header/Footer', type: 'header_footer' },
                { name: 'Spacer', type: 'spacer' }
            ]
        };

        for (const category in nodeCategories) {
            const section = document.createElement('div');
            section.className = 'sidebar-section';
            section.innerHTML = `<div class="sidebar-title">${category}</div>`;

            const list = document.createElement('div');
            list.className = 'node-add-list';
            nodeCategories[category].forEach(node => {
                const item = document.createElement('a');
                item.href = '#';
                item.textContent = node.name;
                item.className = 'node-add-item';
                item.onclick = (e) => {
                    e.preventDefault();
                    const canvasRect = this.canvas.getBoundingClientRect();
                    const x = (-this.canvasOffset.x + canvasRect.width / 2) / this.scale;
                    const y = (-this.canvasOffset.y + canvasRect.height / 2) / this.scale;
                    this.createNode(node.type, x, y);
                    this.deselectAll();
                };
                list.appendChild(item);
            });
            section.appendChild(list);
            this.sidebarContent.appendChild(section);
        }
    }

    addShowcaseFindReplace() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"text","x":50,"y":50,"width":"280px","height":"150px","content":{"text":"Hello world, this is a test. Hello again!"}},{"id":"node_1","type":"find_replace","x":350,"y":50,"width":"280px","height":"200px","content":{"find":"Hello","replace":"Hi","regex":false,"global":true,"case_sensitive":false}},{"id":"node_2","type":"text","x":650,"y":50,"width":"280px","height":"150px","content":{"text":""}}],"connections":[{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_1","socket":"input_text"}},{"from":{"node":"node_1","socket":"output_text"},"to":{"node":"node_2","socket":"text_in"}}]}`;
        this.loadShowcase(showcaseData);
    }
    
    addShowcaseCSVProcessing() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"import","x":50,"y":50,"width":"280px","height":"200px","content":{"data_out":"name,age,department,salary\\nAlice,28,Engineering,75000\\nBob,32,Marketing,68000\\nCharlie,25,Engineering,72000\\nDiana,35,Marketing,71000\\nEve,29,HR,65000"}},{"id":"node_1","type":"csv","x":380,"y":50,"width":"200px","height":"150px","content":{}},{"id":"node_2","type":"filter","x":630,"y":50,"width":"280px","height":"180px","content":{"condition":"row.age > 27 && row.department === 'Engineering'"}},{"id":"node_3","type":"transform","x":960,"y":50,"width":"300px","height":"200px","content":{"logic":"// Calculate annual bonus\\nreturn {\\n  ...row,\\n  price: parseFloat(row.price),\\n  quantity: parseInt(row.quantity),\\n  revenue: parseFloat(row.price) * parseInt(row.quantity)\\n};"}},{"id":"node_4","type":"export","x":1310,"y":50,"width":"300px","height":"300px","content":{}}],"connections":[{"from":{"node":"node_0","socket":"data_out"},"to":{"node":"node_1","socket":"csv_in"}},{"from":{"node":"node_1","socket":"data_out"},"to":{"node":"node_2","socket":"data_in"}},{"from":{"node":"node_2","socket":"data_out"},"to":{"node":"node_3","socket":"data_in"}},{"from":{"node":"node_3","socket":"data_out"},"to":{"node":"node_4","socket":"data_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    addShowcaseJSONTransform() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"import","x":50,"y":50,"width":"320px","height":"280px","content":{"data_out":"[\\n  {\\"user_id\\": 1, \\"first_name\\": \\"John\\", \\"last_name\\": \\"Doe\\", \\"email\\": \\"john@example.com\\", \\"birth_year\\": 1990},\\n  {\\"user_id\\": 2, \\"first_name\\": \\"Jane\\", \\"last_name\\": \\"Smith\\", \\"email\\": \\"jane@example.com\\", \\"birth_year\\": 1985},\\n  {\\"user_id\\": 3, \\"first_name\\": \\"Bob\\", \\"last_name\\": \\"Johnson\\", \\"email\\": \\"bob@example.com\\", \\"birth_year\\": 1992}\\n]"}},{"id":"node_1","type":"json","x":420,"y":50,"width":"200px","height":"150px","content":{"operation":"parse"}},{"id":"node_2","type":"transform","x":670,"y":50,"width":"320px","height":"220px","content":{"logic":"// Transform user data\\nconst currentYear = new Date().getFullYear();\\nreturn {\\n  id: row.user_id,\\n  full_name: \`\${row.first_name} \${row.last_name}\`,\\n  email: row.email,\\n  age: currentYear - row.birth_year,\\n  domain: row.email.split('@')[1]\\n};"}},{"id":"node_3","type":"aggregate","x":1040,"y":50,"width":"250px","height":"180px","content":{"groupBy":"domain","aggFunc":"count","aggKey":"id"}},{"id":"node_4","type":"json","x":1340,"y":50,"width":"200px","height":"150px","content":{"operation":"stringify"}},{"id":"node_5","type":"export","x":1590,"y":50,"width":"280px","height":"250px","content":{}}],"connections":[{"from":{"node":"node_0","socket":"data_out"},"to":{"node":"node_1","socket":"data_in"}},{"from":{"node":"node_1","socket":"data_out"},"to":{"node":"node_2","socket":"data_in"}},{"from":{"node":"node_2","socket":"data_out"},"to":{"node":"node_3","socket":"data_in"}},{"from":{"node":"node_3","socket":"data_out"},"to":{"node":"node_4","socket":"data_in"}},{"from":{"node":"node_4","socket":"data_out"},"to":{"node":"node_5","socket":"data_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    addShowcaseDataAnalysis() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"import","x":50,"y":50,"width":"300px","height":"220px","content":{"data_out":"product,category,price,quantity,region\\nLaptop,Electronics,999.99,5,North\\nMouse,Electronics,29.99,20,North\\nKeyboard,Electronics,79.99,15,North\\nChair,Furniture,299.99,8,South\\nDesk,Furniture,499.99,3,South\\nLaptop,Electronics,999.99,7,South\\nMouse,Electronics,29.99,25,West"}},{"id":"node_1","type":"csv","x":380,"y":50,"width":"200px","height":"150px","content":{}},{"id":"node_2","type":"transform","x":630,"y":50,"width":"280px","height":"200px","content":{"logic":"// Calculate revenue per item\\nreturn {\\n  ...row,\\n  price: parseFloat(row.price),\\n  quantity: parseInt(row.quantity),\\n  revenue: parseFloat(row.price) * parseInt(row.quantity)\\n};"}},{"id":"node_3","type":"aggregate","x":960,"y":50,"width":"250px","height":"180px","content":{"groupBy":"category","aggFunc":"sum","aggKey":"revenue"}},{"id":"node_4","type":"aggregate","x":960,"y":280,"width":"250px","height":"180px","content":{"groupBy":"region","aggFunc":"sum","aggKey":"revenue"}},{"id":"node_5","type":"export","x":1260,"y":50,"width":"280px","height":"200px","content":{}},{"id":"node_6","type":"export","x":1260,"y":280,"width":"280px","height":"200px","content":{}}],"connections":[{"from":{"node":"node_0","socket":"data_out"},"to":{"node":"node_1","socket":"csv_in"}},{"from":{"node":"node_1","socket":"data_out"},"to":{"node":"node_2","socket":"data_in"}},{"from":{"node":"node_2","socket":"data_out"},"to":{"node":"node_3","socket":"data_in"}},{"from":{"node":"node_2","socket":"data_out"},"to":{"node":"node_4","socket":"data_in"}},{"from":{"node":"node_3","socket":"data_out"},"to":{"node":"node_5","socket":"data_in"}},{"from":{"node":"node_4","socket":"data_out"},"to":{"node":"node_6","socket":"data_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    addShowcaseComplexPipeline() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"import","x":50,"y":50,"width":"280px","height":"200px","content":{"data_out":"emp_id,name,department,salary\\n101,Alice Johnson,Engineering,75000\\n102,Bob Smith,Marketing,68000\\n103,Carol Davis,Engineering,72000\\n104,David Wilson,HR,65000"}},{"id":"node_1","type":"import","x":50,"y":300,"width":"280px","height":"180px","content":{"data_out":"dept_id,dept_name,manager,budget\\nEngineering,Engineering,Sarah Chen,500000\\nMarketing,Marketing,Mike Rodriguez,300000\\nHR,Human Resources,Lisa Brown,200000"}},{"id":"node_2","type":"csv","x":380,"y":50,"width":"200px","height":"150px","content":{}},{"id":"node_3","type":"csv","x":380,"y":300,"width":"200px","height":"150px","content":{}},{"id":"node_4","type":"merge","x":630,"y":175,"width":"280px","height":"180px","content":{"key":"department=dept_name"}},{"id":"node_5","type":"filter","x":960,"y":175,"width":"280px","height":"180px","content":{"condition":"parseFloat(row.salary) > 70000"}},{"id":"node_6","type":"transform","x":1290,"y":175,"width":"320px","height":"220px","content":{"logic":"// Calculate salary vs budget ratio\\nconst budgetRatio = (parseFloat(row.salary) / parseFloat(row.budget) * 100).toFixed(2);\\nreturn {\\n  employee: row.name,\\n  department: row.department,\\n  manager: row.manager,\\n  salary: parseFloat(row.salary),\\n  budget_percentage: \`\${budgetRatio}%\`\\n};"}},{"id":"node_7","type":"export","x":1660,"y":175,"width":"300px","height":"250px","content":{}}],"connections":[{"from":{"node":"node_0","socket":"data_out"},"to":{"node":"node_2","socket":"csv_in"}},{"from":{"node":"node_1","socket":"data_out"},"to":{"node":"node_3","socket":"csv_in"}},{"from":{"node":"node_2","socket":"data_out"},"to":{"node":"node_4","socket":"data_in_1"}},{"from":{"node":"node_3","socket":"data_out"},"to":{"node":"node_4","socket":"data_in_2"}},{"from":{"node":"node_4","socket":"data_out"},"to":{"node":"node_5","socket":"data_in"}},{"from":{"node":"node_5","socket":"data_out"},"to":{"node":"node_6","socket":"data_in"}},{"from":{"node":"node_6","socket":"data_out"},"to":{"node":"node_7","socket":"data_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    addShowcaseAutomation() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"text","x":50,"y":50,"width":"300px","height":"150px","content":{"text":"This is an exampel of some text with a sentance about my great product."}},{"id":"node_1","type":"spell_check","x":400,"y":50,"width":"250px","height":"150px","content":{}},{"id":"node_2","type":"translation","x":400,"y":250,"width":"250px","height":"150px","content":{"targetLang":"es"}},{"id":"node_3","type":"sentiment_analysis","x":400,"y":450,"width":"250px","height":"150px","content":{}},{"id":"node_4","type":"export","x":700,"y":50,"width":"300px","height":"100px","content":{}},{"id":"node_5","type":"export","x":700,"y":250,"width":"300px","height":"100px","content":{}},{"id":"node_6","type":"export","x":700,"y":450,"width":"300px","height":"100px","content":{}}],"connections":[{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_1","socket":"text_in"}},{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_2","socket":"text_in"}},{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_3","socket":"text_in"}},{"from":{"node":"node_1","socket":"text_out"},"to":{"node":"node_4","socket":"data_in"}},{"from":{"node":"node_2","socket":"text_out"},"to":{"node":"node_5","socket":"data_in"}},{"from":{"node":"node_3","socket":"sentiment"},"to":{"node":"node_6","socket":"data_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    addShowcasePublishing() {
        const showcaseData = `{"nodes":[{"id":"node_0","type":"text","x":50,"y":150,"width":"350px","height":"250px","content":{"text":"<h1>Project Report</h1><p>This is the final report for the project. It includes all the key findings and recommendations.</p><ul><li>Finding 1</li><li>Finding 2</li></ul>"}},{"id":"node_1","type":"html_render","x":450,"y":50,"width":"300px","height":"200px","content":{}},{"id":"node_2","type":"pdf","x":450,"y":280,"width":"200px","height":"120px","content":{}},{"id":"node_3","type":"email","x":450,"y":430,"width":"250px","height":"150px","content":{"to":"team@example.com","subject":"Project Report"}}],"connections":[{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_1","socket":"text_in"}},{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_2","socket":"text_in"}},{"from":{"node":"node_0","socket":"text_out"},"to":{"node":"node_3","socket":"text_in"}}]}`;
        this.loadShowcase(showcaseData);
    }

    clearCanvas() {
        this.world.querySelectorAll('.node').forEach(el => el.remove());
        this.connectionsContainer.innerHTML = '<defs><linearGradient id="wireGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#5CAF60;stop-opacity:1" /><stop offset="50%" style="stop-color:#4CAF50;stop-opacity:1" /><stop offset="100%" style="stop-color:#3E9142;stop-opacity:1" /></linearGradient></defs>';
        this.nodes.clear();
        this.connections = [];
        this.deselectAll();
        this.recordState("Clear Canvas");
    }

    recordState(description) {
        if (this.history.isRestoring) return;
        const state = this.serialize();
        if (this.history.undoStack.length > 0 && this.history.undoStack[this.history.undoStack.length - 1] === state) {
            return;
        }
        this.history.undoStack.push(state);
        if (this.history.undoStack.length > this.history.maxHistory) {
            this.history.undoStack.shift();
        }
        this.history.redoStack = [];
        this.updateHistoryButtons();
    }

    undo() {
        if (this.history.undoStack.length <= 1) return;
        const currentState = this.history.undoStack.pop();
        this.history.redoStack.push(currentState);
        const prevState = this.history.undoStack[this.history.undoStack.length - 1];
        this.deserialize(prevState);
        this.updateHistoryButtons();
    }

    redo() {
        if (this.history.redoStack.length === 0) return;
        const nextState = this.history.redoStack.pop();
        this.history.undoStack.push(nextState);
        this.deserialize(nextState);
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        document.getElementById('undo-btn').disabled = this.history.undoStack.length <= 1;
        document.getElementById('redo-btn').disabled = this.history.redoStack.length === 0;
    }

    serialize() {
        const state = {
            nodes: [],
            connections: this.connections,
            canvasOffset: this.canvasOffset,
            scale: this.scale,
            nodeCounter: this.nodeCounter
        };
        this.nodes.forEach((nodeData, nodeId) => {
            const nodeEl = nodeData.element;
            const serializedNode = {
                id: nodeId,
                type: nodeData.type,
                x: nodeEl.offsetLeft,
                y: nodeEl.offsetTop,
                width: nodeEl.style.width,
                height: nodeEl.style.height,
                content: {},
                properties: nodeData.properties,
                codeBlockProperties: nodeData.codeBlockProperties,
                parentId: nodeData.parentId,
                children: nodeData.children
            };
            nodeEl.querySelectorAll('[data-param], [data-output]').forEach(el => {
                const key = el.dataset.param || el.dataset.output;
                if (key) {
                    serializedNode.content[key] = el.type === 'checkbox' ? el.checked : el.value;
                }
            });
            state.nodes.push(serializedNode);
        });
        return JSON.stringify(state, null, 2);
    }

    deserialize(jsonString) {
        this.history.isRestoring = true;
        try {
            const state = JSON.parse(jsonString);
            
            this.world.querySelectorAll('.node').forEach(el => el.remove());
            this.nodes.clear();
            this.connections = [];

            this.canvasOffset = state.canvasOffset || { x: 0, y: 0 };
            this.scale = state.scale || 1;
            this.nodeCounter = state.nodeCounter || 0;
            this.updateWorldTransform();

            state.nodes.forEach(nodeState => {
                const options = {
                    ...nodeState.content,
                    id: nodeState.id,
                    width: nodeState.width,
                    height: nodeState.height,
                    properties: nodeState.properties,
                    codeBlockProperties: nodeState.codeBlockProperties,
                    parentId: nodeState.parentId,
                    children: nodeState.children,
                    fromSerialization: true
                };
                this.createNode(nodeState.type, nodeState.x, nodeState.y, options);
            });

            this.connections = state.connections || [];
            this.nodes.forEach(node => this.processNodeData(node.element.id));
            
            // Defer visual updates until after the browser has rendered the new nodes
            setTimeout(() => {
                this.updateConnections();
                this.updateSocketStates();
                this.nodes.forEach(nodeData => {
                    if (nodeData.isContainer) {
                        this.updateLayout(nodeData.element.id);
                    }
                });
            }, 0);

        } catch (e) {
            console.error("Failed to load state:", e);
            alert("Error: Could not load the session file. It might be corrupted.");
        } finally {
            this.history.isRestoring = false;
        }
    }

    saveSession() {
        try {
            const sessionData = this.serialize();
            const blob = new Blob([sessionData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `node-session-${Date.now()}.nodeide`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to save session:", e);
            alert("Error: Could not save the session.");
        }
    }

    loadSession(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.deserialize(content);
            this.history.undoStack = [this.serialize()];
            this.history.redoStack = [];
            this.updateHistoryButtons();
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // --- SELECTION METHODS ---
    
    checkSelection(selectionRect) {
        this.nodes.forEach(nodeData => {
            const nodeEl = nodeData.element;
            const nodeRect = nodeEl.getBoundingClientRect();

            const isIntersecting = !(
                nodeRect.right < selectionRect.left ||
                nodeRect.left > selectionRect.right ||
                nodeRect.bottom < selectionRect.top ||
                nodeRect.top > selectionRect.bottom
            );

            if (isIntersecting) {
                if (!this.selectedNodes.has(nodeEl.id)) {
                    this.selectedNodes.add(nodeEl.id);
                    nodeEl.classList.add('selected');
                }
            }
        });
        
        if (this.selectedNodes.size > 1) {
            this.populateSidebarForMultiSelect();
        } else if (this.selectedNodes.size === 1) {
            this.analyzeContentAndRepopulateSidebar(this.selectedNodes.values().next().value);
        }
    }
    
    // --- LAYOUT AND STRUCTURE METHODS ---

    handleDragOver(event) {
        if (!this.draggedNode) return;
        const draggedRect = this.draggedNode.getBoundingClientRect();
        const centerX = draggedRect.left + draggedRect.width / 2;
        const centerY = draggedRect.top + draggedRect.height / 2;

        let foundTarget = false;
        this.nodes.forEach(nodeData => {
            if (nodeData.isContainer && nodeData.element.id !== this.draggedNode.id) {
                const containerRect = nodeData.element.getBoundingClientRect();
                if (centerX > containerRect.left && centerX < containerRect.right &&
                    centerY > containerRect.top && centerY < containerRect.bottom) {
                    nodeData.element.classList.add('drop-target');
                    foundTarget = true;
                } else {
                    nodeData.element.classList.remove('drop-target');
                }
            }
        });
    }

    handleDrop(event) {
        const dropTargetEl = this.world.querySelector('.node.drop-target');
        this.world.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

        if (!this.draggedNode) return;

        const draggedNodeData = this.nodes.get(this.draggedNode.id);
        const oldParentId = draggedNodeData.parentId;

        if (dropTargetEl && dropTargetEl.id !== oldParentId) {
            const containerData = this.nodes.get(dropTargetEl.id);
            
            if (oldParentId) {
                const oldParentData = this.nodes.get(oldParentId);
                if (oldParentData) {
                    oldParentData.children = oldParentData.children.filter(id => id !== this.draggedNode.id);
                    this.updateLayout(oldParentId);
                }
            }
            
            containerData.children.push(this.draggedNode.id);
            draggedNodeData.parentId = dropTargetEl.id;
            this.updateLayout(dropTargetEl.id);

        } else if (!dropTargetEl && oldParentId) {
            const oldParentData = this.nodes.get(oldParentId);
            if (oldParentData) {
                oldParentData.children = oldParentData.children.filter(id => id !== this.draggedNode.id);
                draggedNodeData.parentId = null;
                this.updateLayout(oldParentId);
            }
        }
    }

    updateLayout(containerId) {
        const containerData = this.nodes.get(containerId);
        if (!containerData || !containerData.isContainer) return;

        switch (containerData.type) {
            case 'column':
                this.layoutColumn(containerData);
                break;
            default:
                break;
        }
    }
    
    layoutColumn(containerData) {
        const containerEl = containerData.element;
        const padding = 20;
        let currentY = padding;

        containerData.children.forEach(childId => {
            const childData = this.nodes.get(childId);
            if (childData) {
                const childEl = childData.element;
                childEl.style.left = (containerEl.offsetLeft + padding) + 'px';
                childEl.style.top = (containerEl.offsetTop + currentY) + 'px';
                currentY += childEl.offsetHeight + padding / 2;
            }
        });
        
        const newHeight = Math.max(100, currentY);
        containerEl.style.height = newHeight + 'px';
        this.updateConnections();
    }
}

let ide;
    
function changeTheme(theme) { 
    document.body.setAttribute('data-theme', theme);
    const mermaidTheme = (['dark', 'dracula', 'tokyonight', 'monokai', 'solarized'].includes(theme)) ? 'dark' : 'default';
    mermaid.initialize({ startOnLoad: false, theme: mermaidTheme });
    ide.nodes.forEach((nodeData, nodeId) => {
        if (nodeData.element.classList.contains('preview-mode')) {
            ide.togglePreview(nodeId).then(() => ide.togglePreview(nodeId));
        }
    });
}
    
// This ensures the script runs after the HTML document has been fully parsed.
document.addEventListener('DOMContentLoaded', () => {
    ide = new NodeBasedIDE();
    ide.addShowcaseAutomation();
});
