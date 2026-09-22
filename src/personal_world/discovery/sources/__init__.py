"""Source adapter registry."""

from .github_releases import GitHubReleasesSource

SOURCE_TYPES = {
    "github_releases": GitHubReleasesSource,
}
