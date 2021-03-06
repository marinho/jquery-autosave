// This JQuery plugin has been tested with JQuery version 1.2.3 and Google
// Gears browser plugin.
// It shoul be working well on Firefox, IE, Chrome, Opera and others browsers
// that supports Google Gears and JQuery and working well also on Windows,
// Linux and Mac.
// But you know: you shouldn't never trust Windows and Internet Explorer
// when the topic is use something really cool on the web.
// Ok, I warned. Please, don't bore me if you have problems :P
//
// This software is licensed under LGPL and you are free to use, distribute,
// modify, bla-bla-bla since you respect my rights as the author and be aware
// I don't give you any warranty for anything. Thanks.

// To use this script you must have others scripts before in your HTML HEAD tag:
// - jquery-packed.js (or other jquery javascript file)
// - md5.js
// - gears_init.js
// - a script initializing Google Gears store name and manifest (something
//   like the "go_offline.js" you can find in the Gears official tutorial

// This script works better if you use the CSS file 'jquery-autosave.css'

// What is not working:
// - everything
// - <input type="file"/>

//-----------------------------------------------------------------
// Valid params
// must be a dictionary value with possible values:
// - 'fields'
//      Inform fields list you want to save. Optional.
//      Default value is all the fields, except to "file" inputs.
// 'hash_id'
//      Hash code that identifies the this form. Optional.
//      Default value is the current URL
// 'key_fields'
//      Form key field. Optional.
//      Default value is have no form key field.
//-----------------------------------------------------------------

var autosave_forms_params = {};
var autosave_db = null;

jQuery.fn.autosave = function(params) {
    if (!window.google || !google.gears) {
        alert("Warning: To use AutoSave function, you must install Gears "+
              "first. Go to http://gears.google.com/ and get it for free!");
        return
    }

    var params = params != undefined ? params : {};

    // Run the wrapper for each one form
    $(this).each(function(){
        autosave_forms_params[$(this)] = params;

        // Initialize current session id node
        if (autosave_forms_params[$(this)]['session_id'] == undefined) {
            autosave_forms_params[$(this)]['session_id'] = null;
        }
        textOut('Session ID is '+autosave_forms_params[$(this)]['session_id']);

        // Default value for 'fields'
        if (autosave_forms_params[$(this)]['fields'] == undefined) {
            var fields = [];

            $(this).find(':input').each(function(){
                fields.push($(this).attr('name'));
            });

            autosave_forms_params[$(this)]['fields'] = fields;
        }

        // Default value for 'hash_id'
        if (autosave_forms_params[$(this)]['hash_id'] == undefined) {
            autosave_forms_params[$(this)]['hash_id'] = create_hash_from_url(window.location.href);
        }

        // Default value for 'key_fields'
        if (autosave_forms_params[$(this)]['key_fields'] == undefined) {
            autosave_forms_params[$(this)]['key_fields'] = [];
        }

        // Initialize database
        prepare_database();

        // Shows saved sessions if they exist to user choose one if it want
        show_saved_sessions(this);
        
        // Set 'change' event to fields update auto-saving
        var fields = autosave_forms_params[$(this)]['fields'];
        for (var i=0;i<fields.length;i++) {
            $(this).find(':input[name='+fields[i]+']').change(function(){
                save_form_to_gears(find_form_as_parent(this));
            });
        }

        // Event for form submittion. When the form is submited, the current session must be removed
        $(this).submit(function(){
            // Go ahead only if there is a session in action
            if (!autosave_forms_params[$(this)]['session_id']) return
            
            // Remove the current session
            remove_saved_session(autosave_forms_params[$(this)]['session_id'], this)
        });
    });

    // Function that create a new hash id for the form
    function create_hash_from_url(url) {
        return hex_md5(url);
    }

    // Function that returns a hash id for the form
    function load_form_hash_id(form) {
        return autosave_forms_params[form]['hash_id'];
    }

    // Function that creates the tables necessary on the system
    function prepare_database() {
        // Crestes or load the database
        autosave_db = google.gears.factory.create('beta.database');
        autosave_db.open('jquery.autosave');

        // Sessions table
        //autosave_db.execute('drop table if exists sessions');
        autosave_db.execute(
                'create table if not exists sessions ('+
                '    id int primary key,              '+
                '    hash_id varchar(32),             '+
                '    creation int,                    '+
                '    last_save int,                   '+
                '    field_values text                '+
                ')'
            );

        textOut('Database initialized!');
    }

    // Function that loads the field values from a form and returns
    // a JSON string
    function form_values_to_json(form) {
        var dict = {};
        var fields = autosave_forms_params[form]['fields'];

        for (var i=0;i<fields.length;i++) {
            $(form).find(':input[name='+fields[i]+']').each(function(){
                dict[$(this).attr('name')] = $(this).val();
            });
        }

        return JSON.stringify(dict)
    }

    // Function that get the max id from sessions table and increments one
    function get_next_session_id() {
        var rs = autosave_db.execute('select max(id) from sessions');

        if (rs.isValidRow()) {
            return rs.field(0) + 1;
        } else {
            return 1;
        }
    }

    // 'Save' event to save form to current session
    function save_form_to_gears(form) {
        // Get field values into a dictionary
        var field_values = form_values_to_json(form);
        var hash_id = autosave_forms_params[$(this)]['hash_id'];
        var last_save = new Date().getTime();

        if (autosave_forms_params[$(this)]['session_id']) {
            textOut('Updating session ID # '+autosave_forms_params[$(this)]['session_id'])

            // Update record if already exists
            autosave_db.execute(
                    'update sessions '+
                    'set last_save = ?, field_values = ? '+
                    'where hash_id = ? and id = ?',
                    [last_save, field_values, hash_id,
                     autosave_forms_params[$(this)]['session_id']]
                );
        } else {
            // Get new session id
            autosave_forms_params[$(this)]['session_id'] = get_next_session_id();
            textOut('Inserting session ID # '+autosave_forms_params[$(this)]['session_id'])

            // Insert record if new
            autosave_db.execute(
                    'insert into sessions '+
                    '(id, hash_id, creation, last_save, field_values)'+
                    'values (?, ?, ?, ?, ?)',
                    [autosave_forms_params[$(this)]['session_id'],
                     hash_id, last_save, last_save, field_values]
                );
        }
        
        textOut('AutoSaving form')
    }

    // Function that returns a formated string for the date informed
    function datetime_to_str(datetime) {
        return datetime.getDate()+'/'+datetime.getMonth()+'/'+datetime.getYear()+' at '+
            datetime.getHours()+':'+datetime.getMinutes();
    }

    // Function that shows a panel to user choose a save session. If there are no
    // sessions saved to this form, nothing is shown
    function show_saved_sessions(form) {
        // Removes the autosaved sessions box if it exists
        $('div#autosave_sessions').remove();

        // Quit if there are not saved sessions for this form
        if (!sessions_count(form)) {
            return
        }

        // Initializes the autosaved sessions box
        var div = $('<div id="autosave_sessions"/>').appendTo($(document.body));
        div.append('<h3>Saved sessions</h3>');
        var ul = $('<ul class="autosave_sessions"/>').appendTo(div);
        
        // Load saved sessions
        var rs = autosave_db.execute(
                'select id, creation, last_save, field_values from sessions '+
                'where hash_id = ?'+
                'order by id desc',
                [autosave_forms_params[$(form)]['hash_id']]
            );

        // Loops along the sessions
        while (rs.isValidRow()) {
            var li = $('<li id="autosave_session_'+rs.field(0)+'"/>').appendTo(ul);

            // Calculates last save date
            var last_save = new Date();
            last_save.setTime(rs.field(2))

            li.append('Last save at '+last_save.toLocaleString());
            li.append(' <a href="javascript: void(0)" onclick="load_saved_session('+rs.field(0)+', $(\'form#'+form.id+'\'))">Load</a>');
            li.append(' | <a href="javascript: void(0)" onclick="remove_saved_session('+rs.field(0)+', $(\'form#'+form.id+'\'))">Remove</a>');

            rs.next();
        }
    }
};

// Function that returns count of saved sessions for a form
function sessions_count(form) {
    var rs = autosave_db.execute(
            'select count(*) from sessions where hash_id = ?',
            [autosave_forms_params[$(form)]['hash_id']]
        );

    if (rs.isValidRow()) {
        return rs.field(0);
    } else {
        return 0;
    }
}

// Function that find the form element above another one
function find_form_as_parent(obj) {
    if ($(obj).parent().attr('tagName').toLowerCase() == 'form') {
        return $(obj).parent()
    } else {
        return find_form_as_parent($(obj).parent())
    }
}

// Function that fills the form fields from a JSON string
function json_values_to_form(json, form) {
    // Converts JSON to JavaScript object
    var dict = window.eval('('+json+')');

    for (var key in dict) {
        try {
            $(form).find(':input[name='+key+']').val(dict[key]);
        } catch (e) {
            textOut('Error on "' + key + '" = "' + dict[key] + '"');
        }
    }
}

// 'Load' event to load saved session into form
function load_saved_session(session_id, form) {
    // Sets the current session
    autosave_forms_params[$(form)]['session_id'] = session_id;

    // Loads data from database
    var rs = autosave_db.execute('select field_values from sessions where id = ?', [session_id]);

    /*if (!re.isValidRow()) {
        textOut('There is no session # '+session_id+' in database')
        return
    }*/

    // Calls function to load the JSON string
    json_values_to_form(rs.field(0), form);

    // Closes the panel
    $('div#autosave_sessions').remove();

    textOut('Session # '+session_id+' loaded');
}
    
// 'Remove' event to clear a saved session
function remove_saved_session(session_id, form) {
    // Remove HTML list item
    $('div#autosave_sessions li#autosave_session_'+session_id).remove();

    // Delete record from database
    autosave_db.execute('delete from sessions where id = ?', [session_id]);

    // Close the box if there are no sessions
    if (!sessions_count(form)) {
        $('div#autosave_sessions').remove();
    }

    textOut('Session # '+session_id+' removed');
}

