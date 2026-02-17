import math

def Is_Symbol(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   character: Char
    # VAR_TEMP:
    #   ret: Bool
    # VAR CONSTANT:
    #   0: Int
    context['0'] = 48
    #   9: Int
    context['9'] = 57
    #   A: Int
    context['A'] = 65
    #   Z: Int
    context['Z'] = 90
    #   _a: Int
    context['_a'] = 97
    #   _z: Int
    context['_z'] = 122
    _case_val_1 = CHAR_TO_INT(context['character'])
    if (_case_val_1 >= context['0'] and _case_val_1 <= context['9']) or (_case_val_1 >= context['A'] and _case_val_1 <= context['Z']) or (_case_val_1 >= context['_a'] and _case_val_1 <= context['_z']):
        context['ret'] = False
    else:
        context['ret'] = True
    context['Is Symbol'] = context['ret']


def Delimeter_Position(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   format: String
    # VAR_TEMP:
    #   _format: String
    #   ret: Int
    #   pString: Int
    context['_format'] = context['format']
    context['ret'] = (-1)
    context['pString'] = 1
    while ((not Is_Symbol(STRING_TO_CHAR(LEFT(IN=context['_format'], L=1)))) and (context['pString'] < LEN(context['format']))):
        context['_format'] = RIGHT(IN=context['_format'], L=(LEN(context['_format']) - 1))
        context['pString'] = (context['pString'] + 1)
    if (context['pString'] < LEN(context['format'])):
        context['ret'] = context['pString']
    if ((context['pString'] == LEN(context['format'])) and Is_Symbol(STRING_TO_CHAR(LEFT(IN=context['_format'], L=1)))):
        context['ret'] = context['pString']
    context['Delimeter Position'] = context['ret']


def Upper(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   type: Bool
    #   stringBox: String
    #   status: Int
    #   charArr: Array[0..255] of Char
    #   cntChar: UInt
    #   pChar: Int
    # VAR CONSTANT:
    #   asciiLow: Char
    context['asciiLow'] = 'a'
    #   asciiHigh: Char
    context['asciiHigh'] = 'z'
    #   asciiCaseOffset: Int
    context['asciiCaseOffset'] = 32
    Strg_TO_Chars(Strg=context['string'], pChars=0, Cnt=context['cntChar'], Chars=context['charArr'])
    for _loop_var_1 in range(int(0), int((UINT_TO_INT(context['cntChar']) - 1)) + 1):
        context['pChar'] = _loop_var_1
        if ((context['asciiLow'] <= context['charArr'][int(context['pChar'])]) and (context['charArr'][int(context['pChar'])] <= context['asciiHigh'])):
            context['charArr'][int(context['pChar'])] = INT_TO_CHAR((CHAR_TO_INT(context['charArr'][int(context['pChar'])]) - context['asciiCaseOffset']))
    Chars_TO_Strg(Chars=context['charArr'], pChars=0, Cnt=context['cntChar'], Strg=context['stringBox'])
    context['Upper'] = context['stringBox']


def Is_Format_Character(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   character: Char
    # VAR_TEMP:
    #   ret: Bool
    # VAR CONSTANT:
    #   Y: Int
    context['Y'] = 89
    #   M: Int
    context['M'] = 77
    #   D: Int
    context['D'] = 68
    #   H: Int
    context['H'] = 72
    #   I: Int
    context['I'] = 73
    #   S: Int
    context['S'] = 83
    _case_val_1 = CHAR_TO_INT(context['character'])
    if _case_val_1 == context['Y'] or _case_val_1 == context['M'] or _case_val_1 == context['D'] or _case_val_1 == context['H'] or _case_val_1 == context['I'] or _case_val_1 == context['S']:
        context['ret'] = True
    else:
        context['ret'] = False
    context['Is Format Character'] = context['ret']


def Trim(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   ret: String
    # VAR CONSTANT:
    #   space: String
    context['space'] = ' '
    context['ret'] = context['string']
    while (LEFT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = RIGHT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    while (RIGHT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = LEFT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    context['Trim'] = context['ret']


def Parse_Format(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   format: String
    # VAR_OUTPUT:
    #   codes: String Buffer
    #   delimeters: String Buffer
    # VAR_TEMP:
    #   _delimeters: String Buffer
    #   _codes: String Buffer
    #   pos: Int
    #   _format: String
    #   pArray: Int
    #   _ret_val: Int
    # VAR CONSTANT:
    #   arraySize: Int
    context['arraySize'] = 9
    #   stringLength: Int
    context['stringLength'] = 10
    context['_format'] = context['format']
    context['pos'] = Delimeter_Position(context['_format'])
    while (context['pos'] != (-1)):
        context['_delimeters'].me[int(context['pArray'])] = MID(IN=context['_format'], L=1, P=context['pos'])
        context['_codes'].me[int(context['pArray'])] = LEFT(IN=context['_format'], L=(context['pos'] - 1))
        context['pArray'] = (context['pArray'] + 1)
        context['_format'] = RIGHT(IN=context['_format'], L=(LEN(context['_format']) - context['pos']))
        context['pos'] = Delimeter_Position(context['_format'])
    context['_codes'].me[int(context['pArray'])] = context['_format']
    context['pArray'] = (context['pArray'] + 1)
    context['delimeters'] = context['_delimeters']
    context['codes'] = context['_codes']


def Resolve_Format(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   format: String
    # VAR_OUTPUT:
    #   error message: String
    #   formatCodes: String Buffer
    #   delimeters: String Buffer
    # VAR_TEMP:
    #   _format: String
    #   retError: String
    #   posDelimeter: Int
    context['_format'] = Trim(Upper(context['format']))
    if (not Is_Format_Character(STRING_TO_CHAR(LEFT(IN=context['_format'], L=1)))):
        context['error message'] = 'leading character not y, m, d, h, i, or s'
        return
    context['posDelimeter'] = Delimeter_Position(context['format'])
    if ((context['posDelimeter'] < 2) and (context['posDelimeter'] != (-1))):
        context['error message'] = 'leading character is a delimiter'
        return
    Parse_Format(format=context['_format'], codes=context['formatCodes'], delimeters=context['delimeters'])
