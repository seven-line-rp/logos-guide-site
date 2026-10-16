// Translate presentation only; Russian source data stays stable for routing,
// comparisons and the recorded voice packs. No DOM rewriting or remounts.
export default function localizeJsx({ types: t }) {
  const call = (node) => t.callExpression(t.identifier('__translate'), [node])
  return {
    visitor: {
      Program: {
        exit(path, state) {
          if (state.localized) path.unshiftContainer('body', t.importDeclaration([
            t.importSpecifier(t.identifier('__translate'), t.identifier('translate')),
          ], t.stringLiteral('/src/i18n.js')))
        },
      },
      JSXText(path, state) {
        const lines = path.node.value.split(/\r\n|\n|\r/)
        const text = lines.map((line, i) => {
          let value = line.replace(/\t/g, ' ')
          if (i > 0) value = value.replace(/^ +/, '')
          if (i < lines.length - 1) value = value.replace(/ +$/, '')
          return value
        }).filter(Boolean).join(' ')
        if (!/[А-Яа-яЁё]/.test(text)) return
        state.localized = true
        path.replaceWith(t.jsxExpressionContainer(call(t.stringLiteral(text))))
        path.skip()
      },
      JSXExpressionContainer: { exit(path, state) {
        if (!t.isJSXElement(path.parent) && !t.isJSXFragment(path.parent)) return
        const value = path.node.expression
        if (t.isJSXEmptyExpression(value)) return
        state.localized = true
        path.node.expression = call(value)
      } },
      JSXAttribute(path, state) {
        if (!['title', 'placeholder', 'aria-label', 'alt', 'label'].includes(path.node.name.name)) return
        const value = path.node.value
        if (!value) return
        state.localized = true
        if (t.isStringLiteral(value)) path.node.value = t.jsxExpressionContainer(call(value))
        else if (t.isJSXExpressionContainer(value)) value.expression = call(value.expression)
      },
    },
  }
}
