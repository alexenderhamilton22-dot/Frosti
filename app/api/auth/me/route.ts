import { failure, json, user } from "../../../lib/server";
export async function GET() {
  try {
    return json(await user());
  } catch (error) {
    return failure(error);
  }
}
