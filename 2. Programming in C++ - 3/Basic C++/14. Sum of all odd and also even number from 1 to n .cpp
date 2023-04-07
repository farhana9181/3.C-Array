//Sum of all odd and also even number from 1 to n
#include<iostream>
using namespace std;
int main()
{
  int n,i,j,sum=0,even=0;
  cout<< "Input a number = ";
  cin>> n;
  for(i=1;i<=n;i++)
  {
      if(i%2!=0)
      {
          sum=sum +i;
      } else if(i%2==0)
      {
          even=even +i;
      }
  }
  cout<<"Sum of all  ODD Number from 1 to "<<n<<" is ="<< sum<<endl;
  cout<<"Sum of all Even Number from 1 to "<<n<<" is ="<< even;
  return 0;
}
