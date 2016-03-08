document.getElementById("got-it").addEventListener("click", function() {
  document.querySelector("#disable-tut").checked
  chrome.extension.sendMessage({
    understandTutorial: true,
    disableTutorial: document.querySelector("#disable-tut").checked
  });
  window.close();
}, false);