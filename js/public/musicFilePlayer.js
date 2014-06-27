
/**
 * ownCloud - Music app
 *
 * @author Morris Jobke
 * @author Jörn Dreyer
 * @copyright 2013 Morris Jobke <morris.jobke@gmail.com>
 * @copyright 2013 Jörn Dreyer <jfd@butonic.de>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

$(document).ready(function () {
	if ($('#body-login').length > 0 || !$('#filesApp').val() || !$('#isPublic').val()) {
		return true; //deactivate on login page and non-public-share pages
	}

	$.getScript(OC.linkTo('music', 'js/vendor/soundmanager/script/soundmanager2-jsmin.js'))
		.done(function(){

			soundManager.setup({
				url: OC.linkTo('music', '3rdparty/soundmanager'),
				flashVersion: 8,
				useFlashBlock: true,
				onready: function() {
					var playFile = function (filename, context) {
						// trigger event for play/pause on click
						var filerow = context.$file;
						var fileURL = context.fileList.getDownloadUrl(filename, context.dir);
						var playAction = filerow.find('a[data-action="music-play"]');
						var stopAction = filerow.find('a[data-action="music-stop"]');

						soundManager.stopAll();
						soundManager.destroySound('ownCloudSound');

						soundManager.createSound({
							id: 'ownCloudSound',
							url: fileURL,
							whileplaying: function() {
								//$scope.setTime(this.position/1000, this.duration/1000);
							},
							onstop: function() {
								stopAction.removeClass('permanent');
								stopAction.hide();
								playAction.show();
							},
							onplay: function() {
								//hide allstop actions in fileList
								$('#fileList').find('a[data-action="music-stop"]').hide();
								playAction.hide();
								stopAction.addClass('permanent');
								stopAction.show();
							},
							onfinish: function() {
								playAction.show();
								var nextTrackId = false;
								var playlist = $('tr[data-mime^="audio/"]');
								jQuery.each (playlist, function(i,e) {
									if ($(e).attr('data-file') === filename) {
										nextTrackId = i+1;
									}
								});
								if (nextTrackId && nextTrackId <= playlist.length) {
									playFile($(playlist[nextTrackId]).attr('data-file'));
								}
							},
							volume: 50
						});
						soundManager.play('ownCloudSound');
					};

					var stopPlayback = function (filename, context) {
						var filerow = context.$file;
						var playAction = filerow.find('a[data-action="music-play"]');
						var stopAction = filerow.find('a[data-action="music-stop"]');
						soundManager.togglePause('ownCloudSound');
						stopAction.removeClass('permanent');
						stopAction.hide();
						playAction.show();
					};

					// add play button here
					OCA.Files.fileActions.register(
						'audio',
						'music-play',
						OC.PERMISSION_READ,
						OC.imagePath('music', 'play-big'),
						playFile,
						t('music', 'Play')
					);

					// add stop button here
					OCA.Files.fileActions.register(
						'audio',
						'music-stop',
						OC.PERMISSION_READ,
						OC.imagePath('music', 'pause-big'),
						stopPlayback,
						t('music', 'Stop')
					);
				}
			});

			// http://www.ckut.ca/soundmanagerv297a-20101010/demo/template/deferred-example.html
			soundManager.beginDelayedInit();

		});

	return true;
});
