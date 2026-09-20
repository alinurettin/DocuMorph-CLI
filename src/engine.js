class DocumentTransformer {
  markdownToHtml(md) {
    if (!md) return '';
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\[([^\[]+)\]\(([^\)]+)\)/gim, '<a href="$2">$1</a>')
      .trim();
  }
  jsonToMarkdownTable(jsonArray) {
    if (!Array.isArray(jsonArray) || jsonArray.length === 0) return '';
    const keys = Object.keys(jsonArray[0]);
    const header = '| ' + keys.join(' | ') + ' |';
    const divider = '| ' + keys.map(() => '---').join(' | ') + ' |';
    const rows = jsonArray.map(obj => '| ' + keys.map(k => obj[k] !== undefined ? obj[k] : '').join(' | ') + ' |');
    return [header, divider, ...rows].join('\n');
  }
}
module.exports = DocumentTransformer;