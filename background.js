/*
 Copyright 2016 Spotify AB. All rights reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */


_.contains = function(arr, ent) {
  return arr.indexOf(ent) > -1;
};

_.remove = function(arr, ent) {
  var i = arr.indexOf(ent);
  if (i !== -1) arr.splice(i, 1);
  return arr;
};

var router = window.document.createElement('event-router');

var poll = function() {
  setTimeout(function() {
    chrome.tabs.query({}, function(tabs) {
      var audibleTabs = _.filter(tabs, {audible: true});
      router.dispatchEvent(new CustomEvent('audible-report', {detail: audibleTabs}));
      poll();
    });
  }, 1000);
};

var hushTab;
if (!localStorage.disableTutorial) {
  chrome.browserAction.setPopup({popup: 'popup.html'});
} else {
  chrome.browserAction.onClicked.addListener(function(tab) {
    takeControl(tab);
  });
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.understandTutorial) {
    chrome.tabs.query({
      currentWindow: true,
      active: true
    }, function(tabs) {
      takeControl(tabs[0]);
    });
  }
  if (request.disableTutorial) {
    localStorage.disableTutorial = true;
    chrome.browserAction.setPopup({popup: ''});
    chrome.browserAction.onClicked.addListener(function(tab) {
      takeControl(tab);
    });
  }
});

var takeControl = function(tab) {
  chrome.tabCapture.getCapturedTabs(function(capInfo) {
    //console.log("capture info", capInfo);
    if (_.filter(capInfo, {status: 'active'}).length) {
      //console.log("cap already active");
      window.location.reload();
    } else {
      //console.log("no active set up");
      setUpCapture(tab)
    }
  });
};

var setUpCapture = function(tab) {
  hushTab = tab;
  chrome.tabCapture.capture({audio: true}, function(cap) {
    hushTab.stream = cap;

    var context = new AudioContext();
    var gainNode = context.createGain();
    var sourceNode = context.createMediaStreamSource(cap);

    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);

    router.addEventListener("audible-report", onAudibleReport);

    setControllers(hushTab, context, gainNode);

    chrome.browserAction.setIcon({
      path: "hush3-on1.png"
    });
    chrome.browserAction.setTitle({"title": "Your background music will be muted when another tab makes sound. Click again to disable."});

    poll();
  });
};

var onAudibleReport = function(ev) {
  var audibleTabs = [];
  _.forEach(ev.detail, function(tab) {
    if (tab.id !== hushTab.id) {
      audibleTabs.push(tab);
    }
  });

  // console.log("Hush tab with id " + hushTab.id + " can hear " + (audibleTabs.length ? audibleTabs.length + " audible." : "only bg music"));
  if (audibleTabs.length) {
    hushTab.hush();
  } else {
    hushTab.release();
  }
};

var setControllers = function(tab, context, gainNode) {
  var c = 0;
  var hushed = false;
  tab.hush = function() {
    if (hushed != true) {
      hushed = true;
      var now = context.currentTime;
      gainNode.gain.setTargetAtTime(0.0, now, 0.2);
      chrome.browserAction.setIcon({
        path: "hush3-active.png"
      });
    }
  };
  tab.release = function() {
    if (hushed != false) {
      hushed = false;
      var now = context.currentTime;
      gainNode.gain.setTargetAtTime(1.0, now, 0.5);
    }
    chrome.browserAction.setIcon({
      path: "hush3-on" + (c++ % 2) + ".png"
    });
  };
};

// Reset:
chrome.browserAction.setTitle({"title": "Click if this tab plays your background music."});
chrome.browserAction.setIcon({
  path: "hush3-zzz.png"
});