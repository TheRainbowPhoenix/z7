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


def Format_Code_as_Int(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   formatCode: String
    context['Format Code as Int'] = CHAR_TO_INT(STRING_TO_CHAR(LEFT(IN=context['formatCode'], L=1)))


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


def Add_Leading(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   Leading Character: Char
    #   Desired Length: USInt
    #   String: String
    # VAR_TEMP:
    #   Length: Int
    #   String Box: String
    context['String Box'] = context['String']
    context['Length'] = LEN(context['String Box'])
    while (context['Length'] < context['Desired Length']):
        context['String Box'] = CONCAT_STRING(IN1=context['Leading Character'], IN2=context['String Box'])
        context['Length'] = LEN(context['String Box'])
    context['Add Leading'] = context['String Box']


def Strip_Sign(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   Length: Int
    #   String Box: String
    #   Test Character: String
    # VAR CONSTANT:
    #   +: Char
    context['+'] = '+'
    #   -: Char
    context['-'] = '-'
    context['String Box'] = context['string']
    context['Test Character'] = LEFT_STRING(IN=context['String Box'], L=1)
    if ((context['Test Character'] == context['+']) or (context['Test Character'] == context['-'])):
        context['Length'] = LEN(context['String Box'])
        context['String Box'] = RIGHT_STRING(IN=context['String Box'], L=(context['Length'] - 1))
    context['Strip Sign'] = context['String Box']


def Select_Element_by_Format_Code(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   formatCode: String
    #   d&tStrings: Elements as Strings
    # VAR_OUTPUT:
    #   error message: String
    # VAR_TEMP:
    #   ret: String
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
    _case_val_1 = Format_Code_as_Int(context['formatCode'])
    if _case_val_1 == context['Y']:
        context['ret'] = context['d&tStrings'].year
    elif _case_val_1 == context['M']:
        context['ret'] = context['d&tStrings'].month
    elif _case_val_1 == context['D']:
        context['ret'] = context['d&tStrings'].day
    elif _case_val_1 == context['H']:
        context['ret'] = context['d&tStrings'].hour
    elif _case_val_1 == context['I']:
        context['ret'] = context['d&tStrings'].minute
    elif _case_val_1 == context['S']:
        context['ret'] = context['d&tStrings'].second
    else:
        context['error message'] = 'use y for year, m for month, d for day, h for hour, i for minute, or s for second'
    context['Select Element by Format Code'] = context['ret']


def Add_Leading_Characters_to_Elements(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   elementLengths: Element Lengths
    #   elementsAsStringArray: String Buffer
    # VAR_OUTPUT:
    #   elementsAsStrings: Elements as Strings
    #   error message: String
    # VAR_TEMP:
    #   ret: Elements as Strings
    _case_val_1 = context['elementLengths'].year
    if _case_val_1 == 0:
        context['ret'].year = ''
    elif _case_val_1 == 2:
        context['ret'].year = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(0)])
    elif _case_val_1 == 4:
        context['ret'].year = CONCAT_STRING(IN1='20', IN2=Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(0)]))
    else:
        context['error message'] = 'invalid year format code'
    _case_val_1 = context['elementLengths'].month
    if _case_val_1 == 0:
        context['ret'].month = ''
    elif _case_val_1 == 1:
        context['ret'].month = context['elementsAsStringArray'].me[int(1)]
    elif _case_val_1 == 2:
        context['ret'].month = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(1)])
    else:
        context['error message'] = 'invalid month format code'
    _case_val_1 = context['elementLengths'].day
    if _case_val_1 == 0:
        context['ret'].day = ''
    elif _case_val_1 == 1:
        context['ret'].day = context['elementsAsStringArray'].me[int(2)]
    elif _case_val_1 == 2:
        context['ret'].day = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(2)])
    else:
        context['error message'] = 'invalid day format code'
    _case_val_1 = context['elementLengths'].hour
    if _case_val_1 == 0:
        context['ret'].hour = ''
    elif _case_val_1 == 1:
        context['ret'].hour = context['elementsAsStringArray'].me[int(3)]
    elif _case_val_1 == 2:
        context['ret'].hour = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(3)])
    else:
        context['error message'] = 'invalid hour format code'
    _case_val_1 = context['elementLengths'].minute
    if _case_val_1 == 0:
        context['ret'].minute = ''
    elif _case_val_1 == 1:
        context['ret'].minute = context['elementsAsStringArray'].me[int(4)]
    elif _case_val_1 == 2:
        context['ret'].minute = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(4)])
    else:
        context['error message'] = 'invalid minute format code'
    _case_val_1 = context['elementLengths'].second
    if _case_val_1 == 0:
        context['ret'].second = ''
    elif _case_val_1 == 1:
        context['ret'].second = context['elementsAsStringArray'].me[int(5)]
    elif _case_val_1 == 2:
        context['ret'].second = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['elementsAsStringArray'].me[int(5)])
    else:
        context['error message'] = 'invalid second format code'
    context['elementsAsStrings'] = context['ret']


def Parse_DTL_Elements(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   time_as_dtl: DTL
    # VAR_OUTPUT:
    #   elements as string array: String Buffer
    # VAR_TEMP:
    #   udint_buffer: UDInt_Buffer
    #   pos: DInt
    #   ret: String Buffer
    #   _ret_val: Int
    #   pBuffer: Int
    context['udint_buffer'].me[int(0)] = UINT_TO_UDINT(context['time_as_dtl'].YEAR)
    context['udint_buffer'].me[int(1)] = USINT_TO_UDINT(context['time_as_dtl'].MONTH)
    context['udint_buffer'].me[int(2)] = USINT_TO_UDINT(context['time_as_dtl'].DAY)
    context['udint_buffer'].me[int(3)] = USINT_TO_UDINT(context['time_as_dtl'].HOUR)
    context['udint_buffer'].me[int(4)] = USINT_TO_UDINT(context['time_as_dtl'].MINUTE)
    context['udint_buffer'].me[int(5)] = USINT_TO_UDINT(context['time_as_dtl'].SECOND)
    context['udint_buffer'].me[int(6)] = context['time_as_dtl'].NANOSECOND
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBuffer'] = _loop_var_1
        context['ret'].me[int(context['pBuffer'])] = Trim(Strip_Sign(UDINT_TO_STRING(context['udint_buffer'].me[int(context['pBuffer'])])))
    context['elements as string array'] = context['ret']


def Resolve_Element_Lengths(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   formatCodes: String Buffer
    # VAR_OUTPUT:
    #   elementLengths: Element Lengths
    #   error message: String
    # VAR_TEMP:
    #   code: String
    #   pCode: Int
    #   errorFlag: Bool
    context['errorFlag'] = True
    for _loop_var_1 in range(int(0), int(9) + 1):
        context['pCode'] = _loop_var_1
        context['code'] = context['formatCodes'].me[int(context['pCode'])]
        if (context['code'] == ''):
            return
        if (FIND(IN1=context['code'], IN2='Y') != 0):
            context['elementLengths'].year = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='M') != 0):
            context['elementLengths'].month = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='D') != 0):
            context['elementLengths'].day = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='H') != 0):
            context['elementLengths'].hour = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='I') != 0):
            context['elementLengths'].minute = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='S') != 0):
            context['elementLengths'].second = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        pass # LABEL NEXT
    if context['errorFlag']:
        context['error message'] = 'no valid format code found'


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


def DTL_Elements_to_Strings(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   time_as_dtl: DTL
    #   formatCodes: String Buffer
    # VAR_OUTPUT:
    #   date & time as string: Elements as Strings
    #   error message: String
    # VAR_TEMP:
    #   elementLengths: Element Lengths
    #   elementsAsStringArray: String Buffer
    #   pElement: Int
    #   ret: Elements as Strings
    #   stringBox: String
    #   retErr: String
    Resolve_Element_Lengths(formatCodes=context['formatCodes'], elementLengths=context['elementLengths'], error_message=context['retErr'])
    if (context['retErr'] != ''):
        return
    Parse_DTL_Elements(time_as_dtl=context['time_as_dtl'], elements_as_string_array=context['elementsAsStringArray'])
    Add_Leading_Characters_to_Elements(elementLengths=context['elementLengths'], elementsAsStringArray=context['elementsAsStringArray'], elementsAsStrings=context['ret'], error_message=context['retErr'])
    context['date & time as string'] = context['ret']
    context['error message'] = context['retErr']


def Format_Date_and_Time_Output(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   formatCodes: String Buffer
    #   delimeters: String Buffer
    #   d&tStrings: Elements as Strings
    # VAR_OUTPUT:
    #   error message: String
    # VAR_TEMP:
    #   pCodes: Int
    #   ret: String
    #   retError: String
    for _loop_var_1 in range(int(0), int(9) + 1):
        context['pCodes'] = _loop_var_1
        if (context['formatCodes'].me[int(context['pCodes'])] != ''):
            context['ret'] = CONCAT_STRING(IN1=context['ret'], IN2=Select_Element_by_Format_Code(formatCode=context['formatCodes'].me[int(context['pCodes'])], d_and_tStrings=context['d&tStrings'], error_message=context['retError']))
        if (context['retError'] != ''):
            context['Format Date and Time Output'] = 'error'
            return
        if (context['delimeters'].me[int(context['pCodes'])] != ''):
            context['ret'] = CONCAT_STRING(IN1=context['ret'], IN2=context['delimeters'].me[int(context['pCodes'])])
    context['error message'] = context['retError']
    context['Format Date and Time Output'] = context['ret']


def DTL_to_String(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   time_as_dtl: DTL
    #   format: String
    # VAR_OUTPUT:
    #   error message: String
    # VAR_TEMP:
    #   formatCodes: String Buffer
    #   delimeters: String Buffer
    #   d&tStrings: Elements as Strings
    #   retError: String
    #   return_date_and_time: String
    # VAR CONSTANT:
    #   ERROR: String
    context['ERROR'] = 'error'
    Resolve_Format(format=context['format'], error_message=context['retError'], formatCodes=context['formatCodes'], delimeters=context['delimeters'])
    if (context['retError'] != ''):
        context['DTL to String'] = context['ERROR']
        context['error message'] = context['retError']
        return
    DTL_Elements_to_Strings(time_as_dtl=context['time_as_dtl'], formatCodes=context['formatCodes'], date__and__time_as_string=context['d&tStrings'], error_message=context['retError'])
    context['d&tStrings'].year = context['d&tStrings'].year
    context['d&tStrings'].month = context['d&tStrings'].month
    context['d&tStrings'].day = context['d&tStrings'].day
    context['d&tStrings'].hour = context['d&tStrings'].hour
    context['d&tStrings'].minute = context['d&tStrings'].minute
    context['d&tStrings'].second = context['d&tStrings'].second
    if (context['retError'] != ''):
        context['DTL to String'] = context['ERROR']
        context['error message'] = context['retError']
        return
    context['return_date_and_time'] = Format_Date_and_Time_Output(formatCodes=context['formatCodes'], delimeters=context['delimeters'], d_and_tStrings=context['d&tStrings'], error_message=context['retError'])
    context['DTL to String'] = context['return_date_and_time']


def Publish_System_Time_to_Web_Page(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_TEMP:
    #   _ret_val: Int
    #   _return: String
    #   _system_time: DTL
    #   _error_message: String
    context['_ret_val'] = RD_SYS_T(context['_system_time'])
    context['_return'] = DTL_to_String(time_as_dtl=context['_system_time'], format='yyyy-mm-dd hh:ii:ss', error_message=context['_error_message'])
    context['System_Time_to_Web_Page'] = context['_return']
