export default function toggleFullscreen() {
  if (document.documentElement.requestFullscreen) {
    if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
    document.exitFullscreen();
    }
  }
}
