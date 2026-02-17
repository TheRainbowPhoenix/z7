import math

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


def Parse_Date_And_Time_Elements(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   date & Time: Date_And_Time
    # VAR_OUTPUT:
    #   elements as string array: String Buffer
    # VAR_TEMP:
    #   byteBuffer: Byte Buffer
    #   pos: DInt
    #   ret: String Buffer
    #   _ret_val: Int
    #   pBuffer: Int
    context['_ret_val'] = Serialize(SRC_VARIABLE=context['date & Time'], DEST_ARRAY=context['byteBuffer'].me, POS=context['pos'])
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBuffer'] = _loop_var_1
        context['ret'].me[int(context['pBuffer'])] = Trim(Strip_Sign(INT_TO_STRING(BCD16_TO_INT(BYTE_TO_WORD(context['byteBuffer'].me[int(context['pBuffer'])])))))
    context['elements as string array'] = context['ret']


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


def Elements_to_Strings(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   date & time: Date_And_Time
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
    Parse_Date_And_Time_Elements(date__and__Time=context['date & time'], elements_as_string_array=context['elementsAsStringArray'])
    Add_Leading_Characters_to_Elements(elementLengths=context['elementLengths'], elementsAsStringArray=context['elementsAsStringArray'], elementsAsStrings=context['ret'], error_message=context['retErr'])
    context['date & time as string'] = context['ret']
    context['error message'] = context['retErr']
