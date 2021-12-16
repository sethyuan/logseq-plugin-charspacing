import "@logseq/libs"

const hanzi =
  "[\u2E80-\u2FFF\u31C0-\u31EF\u3300-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]"
const punc = {
  base: "[@&=_\\$%\\^\\*-\\+]",
  open: "[\\(\\[\\{'\"]",
  close: "[,\\.\\?!:\\)\\]\\}'\"]",
}
const latin =
  "[A-Za-z0-9\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u0391-\u03a9\u03b1-\u03c9]" +
  "|" +
  punc.base
const patterns = [
  new RegExp("(" + hanzi + ")(" + latin + "|" + punc.open + ")", "ig"),
  new RegExp("(" + latin + "|" + punc.close + ")(" + hanzi + ")", "ig"),
]

function renderSpacing(el) {
  const textNodes = Array.from(getTextNodes(el))
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
    if (text[text.length - 2] === " " && hasMarkAncestor(textNode, el)) {
      inheritedSpace = true
    }
    text = text.substring(0, text.length - (inheritedSpace ? 2 : 1))

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

function hasMarkAncestor(node, host) {
  let parent = node.parentElement
  while (parent != null && parent !== host) {
    if (parent.nodeName.toLowerCase() === "mark") return true
    parent = parent.parentElement
  }
  return false
}

async function addSpacing(block) {
  if (block == null) return

  let text = block.content
  for (const pattern of patterns) {
    text = text.replace(pattern, "$1 $2")
  }

  if (text !== block.content) {
    await logseq.Editor.updateBlock(block.uuid, text)
  }
}

logseq
  .ready(async () => {
    const overwrite = logseq.settings?.overwrite

    const observer = new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        if (overwrite) {
          for (const node of mutation.removedNodes) {
            // NOTE: All this detection logic is kind of hacky, it should be
            // refactored when the plugin infrastructure can provide
            // this information.
            if (node.className === "editor-inner block-editor") {
              const editBlockID = node.firstChild.id // textarea.id
              // uuid length is 36.
              const blockID = editBlockID.substring(editBlockID.length - 36)
              logseq.Editor.getBlock(blockID).then(addSpacing)
              break
            }
          }
        } else {
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
