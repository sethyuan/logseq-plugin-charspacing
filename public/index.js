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
const latinHanziPattern = new RegExp(`${latin}|${hanzi}`, "i")
const highlightTags = new Set(["mark", "a"])

function renderSpacing(el) {
  const textNodes = Array.from(getTextNodes(el)).filter(
    // source code like elements should be excluded.
    (node) => node.parentElement.attributes["role"]?.value !== "presentation",
  )
  for (let i = 0, inheritedSpace = false; i < textNodes.length; i++) {
    const textNode = textNodes[i]

    // Inline code has a special handling.
    if (textNode.parentElement.nodeName.toLowerCase() === "code") {
      const prevText = textNodes[i - 1]?.data
      if (prevText?.length > 0) {
        const prevChar = prevText[prevText.length - 1]
        if (
          latinHanziPattern.test(prevChar) &&
          textNode.parentElement.nextSibling?.nodeName?.toLowerCase() !==
            "br" &&
          inSameBlock(textNode.parentElement, textNodes[i - 1], el)
        ) {
          textNodes[i - 1].data = `${prevText} `
        }
      }
      const nextText = textNodes[i + 1]?.data
      if (nextText?.length > 0) {
        const nextChar = nextText[0]
        if (
          latinHanziPattern.test(nextChar) &&
          textNode.parentElement.nextSibling?.nodeName?.toLowerCase() !==
            "br" &&
          inSameBlock(textNode.parentElement, textNodes[i + 1], el)
        ) {
          textNodes[i + 1].data = ` ${nextText}`
        }
      }
      // No space should be inherited after processing inline code.
      inheritedSpace = false
      continue
    }

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
      ;[inheritedSpace, throwAway] = shouldInheritOrThrowAway(
        textNode,
        textNodes[i + 1],
        el,
      )
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

function shouldInheritOrThrowAway(node, nextNode, host) {
  let parent = node.parentElement

  while (parent != null && parent !== host) {
    if (highlightTags.has(parent.nodeName.toLowerCase())) {
      // It ends the line.
      if (
        parent.nextSibling?.nodeName?.toLowerCase() === "br" ||
        !inSameBlock(parent, nextNode, host)
      ) {
        return [false, true]
      }
      return [true, false]
    }
    parent = parent.parentElement
  }

  return [false, false]
}

function inSameBlock(a, b, host) {
  const aBlock = findBlock(a, host)
  const bBlock = findBlock(b, host)
  return aBlock === bBlock
}

function findBlock(node, host) {
  if (!node) return undefined

  let parent = node.parentElement
  while (
    parent != null &&
    !(
      parent.tagName.toLowerCase() === "div" &&
      parent.style.display !== "inline"
    ) &&
    parent !== host
  ) {
    parent = parent.parentElement
  }
  return parent
}

async function main() {
  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      for (const node of mutation.addedNodes) {
        if (node.querySelectorAll) {
          const nodes = node.querySelectorAll(
            "div.block-content.inline, .block-parents span",
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

  console.log("#charspacing loaded")
}

logseq.ready(main).catch(console.error)
