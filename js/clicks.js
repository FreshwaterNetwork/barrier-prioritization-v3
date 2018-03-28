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
                            $( "#" + t.id + "mainAccord > h3" ).addClass("accord-header"); 
                            $( "#" + t.id + "mainAccord > div" ).addClass("accord-body");
                            $( "#" + t.id + "customAccord" ).accordion({heightStyle: "fill"});
                            $( "#" + t.id + "customAccord > h3" ).addClass("accord-header"); 
                            $( "#" + t.id + "custmoAccord > div" ).addClass("accord-body");

                    });
                    // update accordians on window resize
                    var doit;
                    $(window).resize(function(){
                            clearTimeout(doit);
                            doit = setTimeout(function() {
                                    t.clicks.updateAccord(t);
                            }, 100);
                    });	
            },
            updateAccord: function(t){
                    var ma = $( "#" + t.id + "mainAccord" ).accordion( "option", "active" );
                    $( "#" + t.id + "mainAccord" ).accordion("destroy");
                    $( "#" + t.id + "mainAccord" ).accordion({heightStyle: "fill"}); 
                    $( "#" + t.id + "mainAccord" ).accordion( "option", "active", ma );	
                    
                    var ca = $( "#" + t.id + "customAccord" ).accordion( "option", "active" );
                    $( "#" + t.id + "customAccord" ).accordion("destroy");
                    $( "#" + t.id + "customAccord" ).accordion({heightStyle: "fill"}); 
                    $( "#" + t.id + "customAccord" ).accordion( "option", "active", ca );	

            }
        });
    }
);
