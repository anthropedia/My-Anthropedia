const config = process.env
import axios from "axios"

async function getData<T>(
  table: string,
  query: object,
  options = { sort: "" }
): Promise<T[] | null> {
  try {
    const response = await axios.get(
      `https://anthropedia.getgrist.com/api/docs/ea9DA9WWELC5UEfkj94QC7/tables/${table}/records`,
      {
        params: { filter: JSON.stringify(query), sort: options.sort },
        headers: {
          Authorization: `Bearer ${config.GRIST_TOKEN}`,
          Accept: "application/json",
        },
      }
    );

    const body = response.data

    if (!body.records.length) return null

    return body.records.map((r) => ({ id: r.id, ...r.fields }))
  } catch (error) {
    console.error(error)
    return null
  }
}

function login(email, password) {
  return axios.post(`${config.TCI_API_URL}/token`, {email, password })
}

function getUser(token) {
  return axios.get(`${config.TCI_API_URL}/user`, { headers: { Authorization: token } })
}

export default {
  getData, login, getUser
}



