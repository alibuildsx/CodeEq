import axios from "axios";

export async function fetchData() {
  const res = await axios.get("https://api.github.com");
  return res.data;
}
