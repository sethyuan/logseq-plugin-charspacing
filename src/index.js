import "@logseq/libs"

async function main() {
  logseq.provideStyle({
    key: "kef-charspacing",
    style: `
    .latex-inline {
      margin-right: 0.4ch;
    }
    `,
  })

  logseq.useSettingsSchema([
    {
      key: "enableSlashSpacing",
      type: "boolean",
      default: false,
      description:
        "开启后 '/' 两边中文会有空格。例如，'人/天' 展示为 '人 / 天'。",
    },
  ])

  const hanzi =
    "\u2E80-\u2FFF\u31C0-\u31EF\u3300-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F"
  const jap = "\u3040-\u30FF"
  const cj = `[${hanzi}${jap}]`
  const punc = {
    base: `[@&=_\\$%\\^\\*-\\+${
      logseq.settings?.enableSlashSpacing ? "/" : ""
    }]`,
    open: "[\\(\\[\\{'\"`]",
    close: "[,\\.\\?!:\\)\\]\\}'\"`]",
  }
  const latinOnly =
    "[A-Za-z0-9\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u0391-\u03a9\u03b1-\u03c9]"
  const latin = `${latinOnly}|${punc.base}`
  const patterns = [
    new RegExp(`(${cj})(${latin}|${punc.open})`, "ig"),
    new RegExp(`(${latin}|${punc.close})(${cj})`, "ig"),
  ]
  const latinHanziPattern = new RegExp(`${latin}|${cj}`, "i")
  const highlightTags = new Set(["mark", "a"])

  function renderSpacing(el) {
    const textNodes = Array.from(getTextNodes(el)).filter(
      // source code like elements should be excluded.
      (node) => node.parentElement.attributes["role"]?.value !== "presentation",
    )
    for (let i = 0, inheritedSpace = false; i < textNodes.length; i++) {
      const textNode = textNodes[i]

      const parent = textNode.parentElement
      const nodeName = parent.nodeName.toLowerCase()
      // Inline code has a special handling.
      if (nodeName === "code") {
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
      // Marker is ignored.
      // Property `:` is ignored.
      if (
        (nodeName === "a" && parent.classList.contains("marker-switch")) ||
        parent.classList.contains("mr-1")
      ) {
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
          // Exclude non-visible text nodes.
          if (subnode.parentElement.offsetParent != null) {
            yield subnode
          }
          break
        case 1:
          // Exclude code blocks
          if (subnode.classList.contains("cp__fenced-code-block")) continue
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

  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.querySelectorAll) {
            const nodes = node.querySelectorAll(
              "div.block-content.inline, div.query-table, .block-parents span, .kef-tocgen-into, .kef-tocgen-page > div > .page, .kef-kb-card-content",
            )
            for (const n of nodes) {
              renderSpacing(n)
            }
          }
        }
      } else if (mutation.type === "attributes") {
        if (mutation.target.classList.contains("cloze-revealed")) {
          renderSpacing(mutation.target)
        }
      } else if (mutation.type === "characterData") {
        if (mutation.target.parentElement.closest(".kef-kb-card") != null) {
          renderSpacing(mutation.target.parentElement)
        }
      }
    }
  })
  observer.observe(parent.document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
    characterData: true,
  })

  logseq.beforeunload(async () => {
    observer.disconnect()
  })

  console.log("#charspacing loaded")
}

logseq.ready(main).catch(console.error)
