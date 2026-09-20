# 🏛️ Technical Architecture Document: DocuMorph-CLI
**Version:** 2.0.0  
**Domain:** Document Compilers & AST Morphology  
**Architect:** 7-Agent SDLC Principal Software Architect  

---

## 1. System Topology & Architecture

```mermaid
flowchart TD
    subgraph Clients [Client Interfaces]
        WebUI["🖥️ Dark-Mode Studio (Port 6007)"]
        CLI["💻 CLI Transpiler (documorph)"]
        Curl["⚡ HTTP REST API Clients"]
    end

    subgraph CoreEngine [DocuMorph-CLI Engine]
        Router["🔀 HTTP Route Dispatcher"]
        Transformer["🧠 DocumentTransformer Coordinator"]
        
        subgraph Subsystems [Morphology Compilers]
            MdTrans["📝 MarkdownTranspiler (AST + Semantic HTML5)"]
            MathParser["📐 LaTeX Math Engine (Inline & Display)"]
            CsvTrans["📊 CsvTransformer (RFC 4180 / JSON / MD Tables)"]
            YamlTrans["⚙️ YamlJsonTransformer (Native YAML Parser)"]
            DiffGen["⚖️ DiffEngine (Myers / LCS Matrix)"]
            MetricsGen["📈 TextMetricsEngine (Flesch-Kincaid)"]
        end

        SSE["📡 SSE Live Event Stream"]
    end

    WebUI --> Router
    CLI --> Transformer
    Curl --> Router
    Router --> Transformer
    Transformer --> MdTrans & CsvTrans & YamlTrans & DiffGen & MetricsGen
    MdTrans --> MathParser
    Transformer -->|Live Deltas| SSE
    SSE -->|text/event-stream| WebUI
```

---

## 2. Subsystem Details

### 2.1 `MarkdownTranspiler` (`src/engine.js`)
- **Block-Level Lexer:** Detects headings, lists, tables, blockquotes, code blocks, thematic breaks, and display math.
- **Inline Token Stashing:** Stashes math equations and code snippets before formatting text, preventing escape conflicts.
- **AST Generation:** Produces clean JSON AST arrays alongside semantic HTML5.

### 2.2 `CsvTransformer` (`src/engine.js`)
- RFC 4180 state-machine scanner handling escaped quotation marks `""` and multi-line values.
- Bidirectional conversion between CSV text, JSON object arrays, and padded Markdown tables.

### 2.3 `YamlJsonTransformer` (`src/engine.js`)
- Indentation-aware YAML parser supporting nested objects, lists, and primitives without external packages.

### 2.4 `DiffEngine` (`src/engine.js`)
- Computes $O(N \cdot M)$ dynamic programming matrix to identify Longest Common Subsequences.
- Formats diffs into standard unified diff blocks with added/deleted line statistics.

### 2.5 `TextMetricsEngine` (`src/engine.js`)
- Analyzes phonetic vowel-cluster syllables, sentences, words, and characters.
- Computes Flesch Reading Ease and Flesch-Kincaid Grade Level scores.
