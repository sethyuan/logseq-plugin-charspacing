import "@logseq/libs"

const hanzi =
  "[\u2E80-\u2FFF\u31C0-\u31EF\u3300-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]"
const punc = {
  base: "[@&=_\\$%\\^\\*-\\+]",
  open: "[\\(\\[\\{'\"`]",
  close: "[,\\.\\?!:\\)\\]\\}'\"`]",
}
const latinOnly =
  "[A-Za-z0-9\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u0391-\u03a9\u03b1-\u03c9]"
const latin = `${latinOnly}|${punc.base}`
const patterns = [
  new RegExp(`(${hanzi})(${latin}|${punc.open})`, "ig"),
  new RegExp(`(${latin}|${punc.close})(${hanzi})`, "ig"),
]
const highlightTags = new Set(["mark", "a"])

function renderSpacing(el) {
  const textNodes = Array.from(getTextNodes(el)).filter(
    // source code like elements should be excluded.
    (node) =>
      node.parentElement.nodeName.toLowerCase() !== "code" &&
      node.parentElement.attributes["role"]?.value !== "presentation",
  )
  for (let i = 0, inheritedSpace = false; i < textNodes.length; i++) {
    const textNode = textNodes[i]
    // Join text with the first character of the next text node for
    // pattern matching.
    let text = `${inheritedSpace ? " " : ""}${textNode.data}${
      textNodes[i + 1]?.data[0] ?? " "
    }`
    // Reset value.
    inheritedSpace = false

    for (const pattern of patterns) {
      text = text.replace(pattern, "$1 $2")
    }
    let throwAway = false
    if (text[text.length - 2] === " ") {
      ;[inheritedSpace, throwAway] = shouldInheritOrThrowAway(textNode, el)
    }
    text = text.substring(
      0,
      text.length - (inheritedSpace || throwAway ? 2 : 1),
    )

    // Avoid DOM mutation when possible.
    if (textNode.data !== text) {
      textNode.data = text
    }
  }
}

function* getTextNodes(node) {
  for (const subnode of node.childNodes) {
    switch (subnode.nodeType) {
      case 3:
        yield subnode
        break
      case 1:
        yield* getTextNodes(subnode)
        break
    }
  }
}

function shouldInheritOrThrowAway(node, host) {
  let parent = node.parentElement

  while (parent != null && parent !== host) {
    if (highlightTags.has(parent.nodeName.toLowerCase())) {
      // It ends the line.
      if (
        parent.nextSibling?.nodeName?.toLowerCase() === "br" ||
        parent.parentElement?.nodeName.toLowerCase() === "div"
      ) {
        return [false, true]
      }
      return [true, false]
    }
    parent = parent.parentElement
  }

  return [false, false]
}

logseq
  .ready(async () => {
    const observer = new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        for (const node of mutation.addedNodes) {
          if (node.querySelectorAll) {
            const nodes = node.querySelectorAll(
              "div.inline, span.inline, div.inline td, div.inline th",
            )
            for (const n of nodes) {
              renderSpacing(n)
            }
          }
        }
      }
    })
    observer.observe(parent.document.body, {
      subtree: true,
      childList: true,
    })

    logseq.beforeunload(async () => {
      observer.disconnect()
    })
  })
  .catch(console.error)
