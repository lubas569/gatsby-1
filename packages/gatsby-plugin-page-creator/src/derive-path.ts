import _ from "lodash"
import slugify from "@sindresorhus/slugify"
import { Reporter } from "gatsby"
import {
  compose,
  removeFileExtension,
  extractFieldWithoutUnion,
  extractAllCollectionSegments,
  switchToPeriodDelimiters,
} from "./path-utils"

const doubleForwardSlashes = /\/\/+/g

// Generates the path for the page from the file path
// product/{Product.id}.js => /product/:id, pulls from nodes.id
// product/{Product.sku__en} => product/:sku__en pulls from nodes.sku.en
// blog/{MarkdownRemark.parent__(File)__relativePath}} => blog/:slug pulls from nodes.parent.relativePath
export function derivePath(
  path: string,
  node: Record<string, any>,
  reporter: Reporter
): string {
  // 1.  Remove the extension
  let pathWithoutExtension = removeFileExtension(path)

  // 2.  Pull out the slug parts that are within { } brackets.
  const slugParts = extractAllCollectionSegments(path)

  // 3.  For each slug parts get the actual value from the node data
  slugParts.forEach(slugPart => {
    // 3.a.  this transforms foo__bar into foo.bar
    const key = compose(
      extractFieldWithoutUnion,
      switchToPeriodDelimiters
    )(slugPart)

    // 3.b  We do node or node.nodes here because we support the special group
    //      graphql field, which then moves nodes in another depth
    const nodeValue = _.get(node.nodes, `[0]${key}`) || _.get(node, key)

    // 3.c  log error if the key does not exist on node
    if (nodeValue === undefined) {
      reporter.error(
        `PageCreator: Could not find value in the following node for key ${slugPart} (transformed to ${key})`
      )
      reporter.log(JSON.stringify(node, null, 4))
      return
    }

    const value = safeSlugify(nodeValue)

    // 3.d  replace the part of the slug with the actual value
    pathWithoutExtension = pathWithoutExtension.replace(slugPart, value)
  })

  // 4.  Remove double forward slashes that could occur in the final URL
  const derivedPath = pathWithoutExtension.replace(doubleForwardSlashes, `/`)

  return derivedPath
}

// If the node value is meant to be a slug, like `foo/bar`, the slugify
// function will remove the slashes. This is a hack to make sure the slashes
// stick around in the final url structuring
function safeSlugify(nodeValue: string): string {
  // The incoming GraphQL data can also be a number
  const input = String(nodeValue)
  const tempArr = input.split(`/`)

  return tempArr.map(v => slugify(v)).join(`/`)
}
