import { URLSearchParams } from "node:url";

export function queryStringParser(url : string) : Record<string, string> {
    const urlSearch = new URLSearchParams(url)
    const parsedQS = Object.create(null)
    for(let key in urlSearch) {
        parsedQS[key] = urlSearch.get(key)
    }
    return parsedQS;
}