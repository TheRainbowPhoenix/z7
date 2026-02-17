import math

def ADP_Encode_Horizontal_Alignment(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['decoded'].center):
        context['_return'] = context['encoded'].center
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].left):
        context['_return'] = context['encoded'].left
        pass # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].right):
        context['_return'] = context['encoded'].right
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Horizontal Alignment'] = context['_return']
