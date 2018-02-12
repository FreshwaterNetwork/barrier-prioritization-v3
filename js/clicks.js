define([
	"dojo/_base/declare"
],
function ( declare ) {
        "use strict";

        return declare(null, {
			appSetup: function(t){
				//make accrodians
				$( function() {
					$( "#" + t.id + "mainAccord" ).accordion({heightStyle: "fill"});
					$( "#" + t.id + "infoAccord" ).accordion({heightStyle: "fill"});
					$( '#' + t.id + 'mainAccord > h3' ).addClass("accord-header"); 
					$( '#' + t.id + 'infoAccord > div' ).addClass("accord-body");
					$( '#' + t.id + 'infoAccord > h3' ).addClass("accord-header"); 
					$( '#' + t.id + 'mainAccord > div' ).addClass("accord-body");
				});
				// update accordians on window resize
				var doit;
				$(window).resize(function(){
					clearTimeout(doit);
					doit = setTimeout(function() {
						t.clicks.updateAccord(t);
					}, 100);
				});	
				// leave the get help section
				$('#' + t.id + 'getHelpBtn').on('click',function(c){		
					if ( $('#' + t.id + 'mainAccord').is(":visible") ){
						$('#' + t.id + 'infoAccord').show();
						$('#' + t.id + 'mainAccord').hide();
						$('#' + t.id + 'getHelpBtn').html('Back to Barrier Prioritization App');
						$('#' + t.id + 'getHelpBtn').removeClass('button-default');
						$('#' + t.id + 'getHelpBtn').addClass('button-primary');
						t.clicks.updateAccord(t);
						$('#' + t.id + 'infoAccord .infoDoc').trigger('click');
					}else{
						$('#' + t.id + 'infoAccord').hide();
						$('#' + t.id + 'mainAccord').show();
						$('#' + t.id + 'getHelpBtn').html('Back to Documentation');
						$('#' + t.id + 'getHelpBtn').addClass('button-default');
						$('#' + t.id + 'getHelpBtn').removeClass('button-primary');
						t.clicks.updateAccord(t);
					}			
				});						
				// Infographic section clicks
				$('#' + t.id + ' .infoIcon').on('click',function(c){
					$('#' + t.id + 'mainAccord').hide();
					$('#' + t.id + 'infoAccord').show();
					$('#' + t.id + 'getHelpBtnWrap').show();
					var ben = c.target.id.split("-").pop();
					$('#' + t.id + 'getHelpBtn').html('Back to Barrier Prioritization App');
					$('#' + t.id + 'getHelpBtn').removeClass('button-default');
					$('#' + t.id + 'getHelpBtn').addClass('button-primary');
					t.clicks.updateAccord(t);	
					$('#' + t.id + 'infoAccord .' + ben).trigger('click');
				});
			},
			updateAccord: function(t){
				var ma = $( "#" + t.id + "mainAccord" ).accordion( "option", "active" );
				var ia = $( "#" + t.id + "infoAccord" ).accordion( "option", "active" );
				$( "#" + t.id + "mainAccord" ).accordion('destroy');	
				$( "#" + t.id +  "infoAccord" ).accordion('destroy');	
				$( "#" + t.id + "mainAccord" ).accordion({heightStyle: "fill"}); 
				$( "#" + t.id + "infoAccord" ).accordion({heightStyle: "fill"});	
				$( "#" + t.id + "mainAccord" ).accordion( "option", "active", ma );		
				$( "#" + t.id + "infoAccord" ).accordion( "option", "active", ia );					
			}
        });
    }
);
