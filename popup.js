const directoryName = 'AddToReminiscence';
const enableLogging = false;

var loginButton = document.getElementById('login-button');
loginButton.addEventListener("click", loginClicked);

var clearButton = document.getElementById('clear-button');
clearButton.addEventListener("click", clearClicked);

var submitButton = document.getElementById('submit-button');
submitButton.addEventListener("click", addUrlClicked);

var shouldArchiveMediaCheckbox = document.getElementById('shouldArchiveMediaCheckbox');
shouldArchiveMediaCheckbox.addEventListener("click", shouldArchiveMediaCheckboxClicked);

chrome.storage.local.get('userInfo',
	function(data){
		if (data && data.userInfo){
			var userInfo = data.userInfo;

			// we retrieved some data from storage
			if (userInfo.isLoggedIn){
				// we're already logged in
				document.getElementById('submit-form').classList.remove('hidden');
				showShouldArchiveMediaCheckbox();
			}
			else {
				// set predefined values, if any
				document.getElementById('username').value = userInfo.username;
				document.getElementById('reminscence-url').value = userInfo.reminscenceUrl;			
	
				// show the login form
				document.getElementById('login-form').classList.remove('hidden');
			}			
		}
		else {
			// user hasn't logged in before
			// show the login form
			document.getElementById('login-form').classList.remove('hidden');		
		}
	}
)

function clearClicked(){
	chrome.storage.local.clear();
	setStatusText('local storage cleared');
	hideStatusTextAfterSeconds(1.2);
	hideShouldArchiveMediaCheckbox();
}

function shouldArchiveMediaCheckboxClicked(){
	log('shouldArchiveMediaCheckboxClicked()');

	// get the existing userinfo object
	chrome.storage.local.get('userInfo').then(function(data){
		var userInfo = data.userInfo;
		userInfo.shouldArchiveMedia = document.getElementById('shouldArchiveMediaCheckbox').checked;
		log('setting userInfo.shouldArchiveMedia = ' + document.getElementById('shouldArchiveMediaCheckbox').checked);

		chrome.storage.local.set({userInfo});
	});	
}

function addUrlClicked(){
	chrome.storage.local.get('userInfo', function(data){
		log('addUrlClicked');
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(tabs) {
            var tabURL = tabs[0].url;
            console.log(tabURL);
				setStatusText('Adding ' + tabURL);
				submitUrlToReminscence(tabURL, data.userInfo);
        });
	});
}

function submitUrlToReminscence(url, userInfo){
	log('.05');
	// load the login page
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			log('1');

			var parser = new DOMParser();
			var doc = parser.parseFromString(xhttp.responseText, "text/html");

			var csrfMiddlewareToken = doc.getElementsByName('csrfmiddlewaretoken')[0].value;
			log('2');
	
			var fullUrl = userInfo.reminscenceUrl + '/' + userInfo.username + '/' + directoryName;
			log(fullUrl);		
	
			var formData = "";
			if (shouldArchiveMedia){
				log('archiving media');
				// prefix the url with 'md:' to force remminiscence to archive all the media on the page as well
				formData = "csrfmiddlewaretoken=" + csrfMiddlewareToken + "&add_url=md:" + url;
			} else {
				log('NOT archiving media');
				formData = "csrfmiddlewaretoken=" + csrfMiddlewareToken + "&add_url=" + url;
			}
			
			log("formData: " + formData);	
		
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (this.readyState == 4) {
					log(xhr);
					
					if (xhr.status == 200){
						setStatusText('success!');
						hideStatusTextAfterSeconds(2.5);
					}
				}
			};
			xhr.open("POST", fullUrl, true);
			xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			xhr.send(formData);
		}
	};
	xhttp.open("GET", userInfo.reminscenceUrl, true);
	xhttp.send();	
}

function shouldArchiveMedia(){
	log(shouldArchiveMedia());

	var shouldArchiveMediaCheckbox = document.getElementById('shouldArchiveMediaCheckbox');
	return shouldArchiveMedia.checked;
}

function loginClicked(){
	var username = document.getElementById('username').value;
	var password = document.getElementById('password').value;
	var reminscenceUrl = document.getElementById('reminscence-url').value;

	var userInfo = {
		'username': username,
		'reminscenceUrl': reminscenceUrl
	};

	saveUserInfo(userInfo);

	userInfo.password = password;

	// first we need to load the login page, and parse two things:
	// 1) the csrfmiddlewaretoken, from the html ('name' == 'csrfmiddlewaretoken')
	// 2) the 'next' value from the html ('name' == 'next')
	// NOTE: we DON'T need to parse the cookie or deal with that - the chrome does it for us

	// load the login page
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			//log(xhttp);

			var parser = new DOMParser();
			var doc = parser.parseFromString(xhttp.responseText, "text/html");

			var csrfMiddlewareToken = doc.getElementsByName('csrfmiddlewaretoken')[0].value;
			chrome.storage.local.set({csrfMiddlewareToken});
			var next = doc.getElementsByName('next')[0].value;

			login(userInfo, csrfMiddlewareToken, next);
		}
	};
	xhttp.open("GET", reminscenceUrl + '/login/?next=/', true);
	xhttp.send();

	setStatusText('Logging in...');
	showStatusText();
}

function setDirectory(userInfo, html){
	// check and see if directory named 'AddToReminiscence' exists. If not, create it. If it does exist, set it in userInfo
	var hasDirectory = false;
	var parser = new DOMParser();
	var doc = parser.parseFromString(html, "text/html");

	var directories = doc.getElementById('tbody').children;

	if (directories.length === 0){
		// no directories exist
		createDirectory(directoryName);
	}
	else {
		for(var i = 0; i < directories.length; i++){
			var currentElement = directories[i];
			log(currentElement);

			if (currentElement.innerHTML.includes(directoryName)){
				hasDirectory = true;
				break;
			}
		}
	}

	if (!hasDirectory){
		createDirectory(directoryName, doc, userInfo);
	}
	else {
		showSubmitForm();
	}
}

function createDirectory(directoryName, doc, userInfo){
	var csrfMiddlewareToken = doc.getElementsByName('csrfmiddlewaretoken')[0].value;
	log(csrfMiddlewareToken);

	// create the directory
	var formData = "csrfmiddlewaretoken=" + csrfMiddlewareToken + "&create_directory=" + directoryName;
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			hideStatusText();
			log(xhttp);
			
			if (xhttp.status == 200){

				// if we're NOT logged in, the response text will contain 'Forgot your password?'
				if (xhttp.responseText.includes(directoryName)){
					setStatusText('Unable to log in.');
					showStatusText();
				} else {
					// we're logged in, hooray!
					setStatusText('Directory ' + directoryName + ' created.');
					showStatusText();
					hideStatusTextAfterSeconds(3);

					showSubmitForm();
				}

			}
		}
	};
	xhttp.open("POST", userInfo.reminscenceUrl, true);
	xhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	xhttp.send(formData);
}

function login(userInfo, csrfMiddlewareToken, next){
	var formData = "csrfmiddlewaretoken=" + csrfMiddlewareToken + "&next=%2F&username=" + userInfo.username + "&password=" + userInfo.password;
	log("formData: " + formData);

	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			hideStatusText();
			log(xhttp);
			
			if (xhttp.status == 200){

				// if we're NOT logged in, the response text will contain 'Forgot your password?'
				if (xhttp.responseText.includes('Forgot your password?')){
					log('not logged in');
					setStatusText('Unable to log in.');
				} else {
					// we're logged in, hooray!
					log('LOGGED IN YAY');
					chrome.storage.local.set({csrfMiddlewareToken});

					setStatusText('Logged in');
					showStatusText();
					hideStatusTextAfterSeconds(5);

					setUserAsLoggedIn();

					hideLoginForm();
					showShouldArchiveMediaCheckbox();

					setDirectory(userInfo, xhttp.responseText);
				}

			}
		}
	};
	xhttp.open("POST", userInfo.reminscenceUrl + '/login/?next=' + next, true);
	xhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	xhttp.send(formData);
}

function isLoggedIn(){
	return storage.local.get('isLoggedIn');
}

function showStatusText(){
	document.getElementById('status-text').classList.remove('hidden');	
}

function hideStatusText(){
	document.getElementById('status-text').classList.add('hidden');	
}

function setStatusText(message){
	document.getElementById('status-text').innerHTML = message;
}

function hideStatusTextAfterSeconds(seconds){
	setTimeout(function(){
		hideStatusText();
	}, seconds * 1000);
}

function hideLoginForm(){
	document.getElementById('login-form').classList.add('hidden');	
}

function setUserAsLoggedIn(){
	chrome.storage.local.get('userInfo',
		function(data){
			var userInfo = {};

			if (data && data.userInfo){
				userInfo = data.userInfo;
				userInfo.isLoggedIn = true;
			}
			else {
				log('we should not be here!');
				userInfo = {
					isLoggedIn: true
				};
			}
			saveUserInfo(userInfo);
		}
    )
}

function setUserAsNotLoggedIn(){
	chrome.storage.local.get('userInfo').then(
		function(data){
			var userInfo = {};

			if (data && data.userInfo){
				userInfo = data.userInfo;
				userInfo.isLoggedIn = false;
			}
			else {
				userInfo = {
					isLoggedIn: false
				};
			}
			saveUserInfo(userInfo);
		},
		function(error){
			log('error');
		}
	)
}

function saveUserInfo(userInfo){
	chrome.storage.local.set({userInfo});
}

function showSubmitForm(){
	document.getElementById('submit-form').classList.remove('hidden');	
}

function hideSubmitForm(){
	document.getElementById('submit-form').classList.add('hidden');	
}

function showShouldArchiveMediaCheckbox(){
	log('shouldArchiveMediaCheckboxClicked()');

	// get the existing userinfo object
	chrome.storage.local.get('userInfo',function(data){
		var userInfo = data.userInfo;

		if (userInfo.shouldArchiveMedia != null && userInfo.shouldArchiveMedia != undefined){
			log('setting archive-c');
			document.getElementById('shouldArchiveMediaCheckbox').checked = userInfo.shouldArchiveMedia
		} else {
			log('userInfo.shouldArchiveMedia is null or undefined');
		}
	});	

	document.getElementById('archive-checkbox-form').classList.remove('hidden');	
}

function hideShouldArchiveMediaCheckbox(){
	document.getElementById('archive-checkbox-form').classList.add('hidden');	
}

function log(message){
	if (enableLogging){
		console.log(message);
	}
}
