import math

def Array_Any_Length(context, global_dbs):
    # Return Type: UDInt
    # VAR_INPUT:
    #   array: Variant
    # VAR_TEMP:
    #   status: DInt
    #   ret: UDInt
    context['ret'] = CountOfElements(context['array'])
    context['Array.Any.Length'] = context['ret']


def WString_Find_Multiple(context, global_dbs):
    # Return Type: Int
    # VAR_INPUT:
    #   body: WString
    #   terms: Array[*] of WString
    #   p_terms: Int
    # VAR_TEMP:
    #   _length: UDInt
    #   _position: Int
    # VAR CONSTANT:
    #   BLANK: WString
    context['_length'] = Array_Any_Length(context['terms'])
    if (((context['p_terms'] > context['_length']) or context['terms'][int(context['p_terms'])]) == context['BLANK']):
        context['WString.Find_Multiple'] = 0
        return
    context['_position'] = FIND(IN1=context['body'], IN2=context['terms'][int(context['p_terms'])])
    if (context['_position'] == 0):
        context['_position'] = WString_Find_Multiple(body=context['body'], terms=context['terms'], p_terms=(context['p_terms'] + 1))
    context['WString.Find_Multiple'] = context['_position']
