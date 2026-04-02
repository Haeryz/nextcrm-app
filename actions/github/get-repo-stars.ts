import { areExternalApisDisabled } from "@/lib/external-apis";

export default async function getGithubRepoStars(): Promise<number> {
  if (areExternalApisDisabled()) {
    return 0;
  }

  const endpoint =
    process.env.NEXT_PUBLIC_GITHUB_REPO_API ||
    "https://api.github.com/repos/pdovhomilja/nextcrm-app";
  const githubToken = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
  };

  if (githubToken && githubToken.trim().length > 0) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return 0;
    }

    const stars = (await response.json()) as { stargazers_count?: number };
    return stars.stargazers_count ?? 0;
  } catch (error) {
    console.error("Error fetching repo stars");
    return 0;
  }
}
