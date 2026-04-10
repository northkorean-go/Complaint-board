import { json, isAdmin } from "./_utils.js";

export async function onRequestGet(context) {
  return json({
    isAdmin: isAdmin(context.request),
  });
}
